import Foundation
import RealityKit

// Uso: photogrammetry <pasta-de-fotos> <pasta-de-saída> [reduced|medium|full] [normal|high]
// Escreve uma linha JSON por evento em stdout: {"progress":0.4} | {"status":"..."} | {"done":"/caminho/model.usdz"} | {"error":"..."}

func emit(_ obj: [String: Any]) {
    if let d = try? JSONSerialization.data(withJSONObject: obj), let s = String(data: d, encoding: .utf8) {
        print(s)
        fflush(stdout)
    }
}

let args = CommandLine.arguments
guard args.count >= 3 else {
    emit(["error": "uso: photogrammetry <fotos> <saida> [reduced|medium|full] [normal|high] [mask|nomask]"])
    exit(2)
}
let inputURL = URL(fileURLWithPath: args[1], isDirectory: true)
let outDir = URL(fileURLWithPath: args[2], isDirectory: true)
let detailArg = args.count > 3 ? args[3] : "medium"
let sensArg = args.count > 4 ? args[4] : "normal"
let maskArg = args.count > 5 ? args[5] : "nomask"

guard PhotogrammetrySession.isSupported else {
    emit(["error": "Este Mac não suporta o Object Capture (precisa de Apple Silicon ou GPU compatível)."])
    exit(3)
}

let detail: PhotogrammetrySession.Request.Detail
switch detailArg {
case "reduced": detail = .reduced
case "full": detail = .full
default: detail = .medium
}

var config = PhotogrammetrySession.Configuration()
config.featureSensitivity = sensArg == "high" ? .high : .normal
config.sampleOrdering = .unordered
config.isObjectMaskingEnabled = (maskArg == "mask") // recorta o fundo/chão; pode cortar partes do carro em alguns casos

do {
    try FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)
    let outURL = outDir.appendingPathComponent("model.usdz")
    let session = try PhotogrammetrySession(input: inputURL, configuration: config)

    Task {
        do {
            for try await output in session.outputs {
                switch output {
                case .inputComplete:
                    emit(["status": "Fotos carregadas, reconstruindo"])
                case .requestProgress(_, let fraction):
                    emit(["progress": fraction])
                case .requestProgressInfo(_, let info):
                    if let eta = info.estimatedRemainingTime { emit(["eta": eta]) }
                case .requestComplete(_, let result):
                    if case .modelFile(let url) = result { emit(["done": url.path]) }
                case .requestError(_, let error):
                    emit(["error": "\(error)"])
                    exit(1)
                case .processingComplete:
                    exit(0)
                case .invalidSample(let id, let reason):
                    emit(["status": "foto \(id) ignorada: \(reason)"])
                case .skippedSample(let id):
                    emit(["status": "foto \(id) sem pontos suficientes"])
                case .automaticDownsampling:
                    emit(["status": "imagens reduzidas automaticamente (pouca memória)"])
                case .stitchingIncomplete:
                    emit(["status": "algumas fotos não se conectaram ao conjunto principal"])
                case .processingCancelled:
                    emit(["error": "cancelado"])
                    exit(1)
                @unknown default:
                    break
                }
            }
        } catch {
            emit(["error": "\(error)"])
            exit(1)
        }
    }

    try session.process(requests: [.modelFile(url: outURL, detail: detail)])
    dispatchMain()
} catch {
    emit(["error": "\(error)"])
    exit(1)
}
