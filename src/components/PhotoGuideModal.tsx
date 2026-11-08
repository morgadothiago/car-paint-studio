import React, { useState } from "react";
import {
  IconCamera,
  IconClose,
  IconSun,
  IconInfo,
  IconAlertCircle,
  IconCheck,
  IconCheckCircle,
  IconRotate360,
  IconArrowRight,
  IconArrowLeft,
  IconUpload,
} from "./Icons";

interface PhotoGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFilesClick?: () => void;
}

type GuideTab = "steps" | "angles" | "modes" | "checklist";

interface AngleInfo {
  id: string;
  angle: string;
  deg: number;
  name: string;
  category: "essential" | "detail" | "360";
  purpose: string;
  tip: string;
  importance: string;
}

const ANGLES_DATA: AngleInfo[] = [
  {
    id: "front",
    angle: "0°",
    deg: 0,
    name: "Frente Direta",
    category: "essential",
    purpose: "Captura grade frontal, faróis, capô, logotipo e parachoque dianteiro.",
    tip: "Fique alinhado com o centro da placa, na altura dos faróis, a ~2,5 metros de distância.",
    importance: "Obrigatório para IA e Fotogrametria",
  },
  {
    id: "front-left",
    angle: "45°",
    deg: 45,
    name: "Diagonal Dianteira Esquerda",
    category: "essential",
    purpose: "Registra a transição entre paralamas, farol esquerdo, roda dianteira e capô.",
    tip: "Posicione-se a 45 graus da frente do veículo sem cortar a lateral nem a frente.",
    importance: "Crucial para a curvatura do para-lama",
  },
  {
    id: "side-left",
    angle: "90°",
    deg: 90,
    name: "Lateral Esquerda Completa",
    category: "essential",
    purpose: "Perfil completo: portas, maçanetas, vidros, coluna e rodas esquerdas.",
    tip: "Fique reto com o centro das duas portas. O carro todo deve caber no enquadramento.",
    importance: "Obrigatório para proporções e entre-eixos",
  },
  {
    id: "rear-left",
    angle: "135°",
    deg: 135,
    name: "Diagonal Traseira Esquerda",
    category: "essential",
    purpose: "Mostra a lanterna esquerda, caixa de roda traseira, vidro traseiro e caimento do teto.",
    tip: "Mantenha a mesma distância de ~2,5 a 3 metros com o carro centralizado.",
    importance: "Essencial para caimento da coluna C",
  },
  {
    id: "rear",
    angle: "180°",
    deg: 180,
    name: "Traseira Direta",
    category: "essential",
    purpose: "Lanternas traseiras, tampa do porta-malas, placa, vidro traseiro e parachoque.",
    tip: "Fique alinhado com o centro do veículo, na altura da tampa do porta-malas.",
    importance: "Obrigatório para IA e Fotogrametria",
  },
  {
    id: "rear-right",
    angle: "225°",
    deg: 225,
    name: "Diagonal Traseira Direita",
    category: "essential",
    purpose: "Lanterna direita, bocal de combustível, caixa de roda e parachoque traseiro.",
    tip: "Enquadre a quina traseira direita mantendo boa luz difusa.",
    importance: "Essencial para simetria traseira",
  },
  {
    id: "side-right",
    angle: "270°",
    deg: 270,
    name: "Lateral Direita Completa",
    category: "essential",
    purpose: "Perfil completo do lado direito: portas, vincos laterais, rodas e retrovisor.",
    tip: "Fique perpendicular ao centro do veículo, na mesma distância do lado esquerdo.",
    importance: "Obrigatório para proporções e entre-eixos",
  },
  {
    id: "front-right",
    angle: "315°",
    deg: 315,
    name: "Diagonal Dianteira Direita",
    category: "essential",
    purpose: "Farol direito, roda dianteira direita, retrovisor e vinco do capô.",
    tip: "Feche a volta dos ângulos principais mantendo o carro centralizado.",
    importance: "Crucial para a curvatura do para-lama",
  },
];

export default function PhotoGuideModal({
  isOpen,
  onClose,
  onSelectFilesClick,
}: PhotoGuideModalProps) {
  const [activeTab, setActiveTab] = useState<GuideTab>("steps");
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedAngleId, setSelectedAngleId] = useState("front");
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});

  if (!isOpen) return null;

  const selectedAngle = ANGLES_DATA.find((a) => a.id === selectedAngleId) ?? ANGLES_DATA[0];

  const steps = [
    {
      title: "1. Preparação do Veículo & Espaço",
      tag: "Passo 1 de 4",
      icon: <IconCheckCircle size={20} className="step-icon-accent" />,
      summary: "Garanta que o carro e o ambiente estejam prontos antes do primeiro clique.",
      points: [
        {
          label: "Carro limpo e seco",
          desc: "Poeira, barro ou gotas de água interferem na leitura de vincos e alteram os tons da cor.",
        },
        {
          label: "Espaço livre de 2 a 3 metros",
          desc: "Estacione em local amplo para poder circular ao redor do carro sem barreiras ou outros veículos colados.",
        },
        {
          label: "Posição fixa e alinhada",
          desc: "Alinhe as rodas dianteiras retas e feche todos os vidros e portas.",
        },
        {
          label: "Carro 100% imóvel",
          desc: "NUNCA mova o carro durante a sessão de fotos. Qualquer movimento quebra a geometria 3D.",
        },
      ],
    },
    {
      title: "2. Iluminação Perfeita (Sem Reflexos)",
      tag: "Passo 2 de 4",
      icon: <IconSun size={20} className="step-icon-accent" />,
      summary: "A luz certa define se o modelo 3D terá cores fieis e superfícies lisas.",
      points: [
        {
          label: "Melhor momento: Dia nublado ou sombra aberta",
          desc: "Luz suave e difusa elimina pontos cegos e sombras pretas duras sob a lataria.",
        },
        {
          label: "EVITE sol direto forte do meio-dia",
          desc: "O sol intenso cria manchas brancas de reflexo (brilho especular) que confundem o algoritmo.",
        },
        {
          label: "NUNCA use o flash da câmera",
          desc: "O flash se move a cada passo que você dá, criando sombras falsas e reflexos em cada ângulo.",
        },
        {
          label: "Evite garagens escuras",
          desc: "Pouca luz gera ruído e granulação digital nas fotos, reduzindo a nitidez das bordas.",
        },
      ],
    },
    {
      title: "3. Enquadramento e Ângulos Chave",
      tag: "Passo 3 de 4",
      icon: <IconCamera size={20} className="step-icon-accent" />,
      summary: "Mantenha consistência de distância e enquadre o carro por completo.",
      points: [
        {
          label: "Carro preenchendo 75% a 80% da tela",
          desc: "Deixe uma pequena margem em volta. Nunca corte os parachoques, teto, retrovisores ou rodas.",
        },
        {
          label: "Distância constante (~2,5 a 3 metros)",
          desc: "Mantenha sempre a mesma distância do carro em todas as fotos tiradas.",
        },
        {
          label: "Use a lente principal (1x)",
          desc: "Evite lentes 0.5x (ultra-wide) pois causam distorção em 'olho de peixe' na lataria.",
        },
        {
          label: "Mantenha a mesma orientação",
          desc: "Tire todas as fotos na horizontal (paisagem) ou todas na vertical (retrato).",
        },
      ],
    },
    {
      title: "4. Volta 360° para Fotogrametria Mac",
      tag: "Passo 4 de 4",
      icon: <IconRotate360 size={20} className="step-icon-accent" />,
      summary: "Para reconstrução 3D real no Mac (Apple Object Capture), faça uma volta contínua.",
      points: [
        {
          label: "Sobreposição de 60% a 70% entre fotos",
          desc: "Cada foto deve conter 2/3 da cena da foto anterior. Dê 1 a 2 passos curtos entre cada disparo.",
        },
        {
          label: "Volta 1: Altura dos faróis e maçanetas",
          desc: "Caminhe ao redor do carro em 360° mantendo a câmera nivelada na altura da cintura.",
        },
        {
          label: "Volta 2: Altura dos olhos (levemente de cima)",
          desc: "Dê uma segunda volta apontando levemente para baixo para registrar capô, teto e vidros.",
        },
        {
          label: "Meta ideal: 30 a 80 fotos (ou vídeo 4K lento)",
          desc: "Quanto mais fotos com boa sobreposição, mais liso e detalhado será o modelo 3D final.",
        },
      ],
    },
  ];

  const checklistItems = [
    "Carro está limpo, seco e com rodas retas",
    "Estacionado em local aberto (ao menos 2m de espaço livre ao redor)",
    "Iluminação natural suave (dia nublado ou sombra, sem sol estourado)",
    "Flash da câmera desligado",
    "Carro não foi movido de lugar durante as fotos",
    "O carro todo aparece em cada foto sem cortar rodas nem teto",
    "Sobreposição contínua (cada foto engloba parte da foto anterior)",
    "Tenho as 4 fotos principais (Frente, Traseira, Laterais) ou 30+ fotos 360°",
  ];

  const toggleCheck = (idx: number) => {
    setCheckedItems((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const completedChecks = Object.values(checkedItems).filter(Boolean).length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-window photo-guide-modal-window" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <div className="modal-guide-badge-icon">
              <IconCamera size={20} />
            </div>
            <div>
              <h3>Guia Passo a Passo: Fotos do Veículo</h3>
              <p className="modal-subtitle">
                Aprenda a fotografar seu carro para gerar um modelo 3D com alta precisão e cores fieis
              </p>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} title="Fechar guia">
            <IconClose size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="photo-guide-tabs">
          <button
            className={`photo-guide-tab ${activeTab === "steps" ? "active" : ""}`}
            onClick={() => setActiveTab("steps")}
          >
            <span>Passo a Passo</span>
          </button>
          <button
            className={`photo-guide-tab ${activeTab === "angles" ? "active" : ""}`}
            onClick={() => setActiveTab("angles")}
          >
            <span>Ângulos Recomendados</span>
          </button>
          <button
            className={`photo-guide-tab ${activeTab === "modes" ? "active" : ""}`}
            onClick={() => setActiveTab("modes")}
          >
            <span>360° Mac vs IA</span>
          </button>
          <button
            className={`photo-guide-tab ${activeTab === "checklist" ? "active" : ""}`}
            onClick={() => setActiveTab("checklist")}
          >
            <span>Checklist Pré-Envio</span>
            {completedChecks > 0 && (
              <span className="checklist-counter-badge">{completedChecks}/{checklistItems.length}</span>
            )}
          </button>
        </div>

        {/* Content Area */}
        <div className="modal-content photo-guide-content">
          {/* TAB 1: STEPS WALKTHROUGH */}
          {activeTab === "steps" && (
            <div className="guide-steps-view">
              {/* Stepper Progress Bar */}
              <div className="stepper-nav">
                {steps.map((st, i) => (
                  <button
                    key={i}
                    className={`stepper-nav-item ${i === currentStep ? "active" : ""} ${i < currentStep ? "done" : ""}`}
                    onClick={() => setCurrentStep(i)}
                  >
                    <span className="stepper-nav-num">{i < currentStep ? "✓" : i + 1}</span>
                    <span className="stepper-nav-text">Etapa {i + 1}</span>
                  </button>
                ))}
              </div>

              {/* Current Step Card */}
              <div className="guide-step-card">
                <div className="guide-step-header">
                  <div className="step-tag-row">
                    <span className="badge badge-accent">{steps[currentStep].tag}</span>
                    <span className="step-summary-text">{steps[currentStep].summary}</span>
                  </div>
                  <h4 className="guide-step-title">{steps[currentStep].title}</h4>
                </div>

                <div className="guide-points-grid">
                  {steps[currentStep].points.map((pt, idx) => (
                    <div key={idx} className="guide-point-card">
                      <div className="guide-point-icon">
                        <IconCheck size={14} />
                      </div>
                      <div className="guide-point-body">
                        <span className="guide-point-label">{pt.label}</span>
                        <span className="guide-point-desc">{pt.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Step Navigation Buttons */}
                <div className="guide-step-nav-footer">
                  <button
                    className="btn-secondary"
                    disabled={currentStep === 0}
                    onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
                  >
                    <IconArrowLeft size={16} /> Anterior
                  </button>
                  {currentStep < steps.length - 1 ? (
                    <button
                      className="btn-primary"
                      onClick={() => setCurrentStep((prev) => Math.min(steps.length - 1, prev + 1))}
                    >
                      Próxima Etapa <IconArrowRight size={16} />
                    </button>
                  ) : (
                    <button
                      className="btn-primary"
                      onClick={() => setActiveTab("angles")}
                    >
                      Ver Diagrama de Ângulos <IconArrowRight size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ANGLES VISUAL SCHEMATIC */}
          {activeTab === "angles" && (
            <div className="guide-angles-view">
              <div className="angles-intro-card">
                <IconInfo size={18} className="text-accent" />
                <span>
                  Clique em qualquer um dos 8 ângulos ao redor do carro para ver as instruções de posicionamento e objetivo de cada foto.
                </span>
              </div>

              <div className="angles-layout-grid">
                {/* 360 Degree Visual Car Diagram */}
                <div className="car-diagram-container">
                  <div className="car-diagram-center-badge">
                    <span className="car-diagram-badge-title">CARRO</span>
                    <span className="car-diagram-badge-sub">Topo</span>
                  </div>

                  {/* Stylized Car Silhouette SVG */}
                  <div className="car-silhouette-wrapper">
                    <svg viewBox="0 0 100 220" className="car-topdown-svg">
                      {/* Car Body Shell */}
                      <path
                        d="M 28 35 C 28 20, 36 10, 50 10 C 64 10, 72 20, 72 35 L 75 75 C 78 80, 80 105, 80 135 L 80 170 C 80 195, 74 208, 50 208 C 26 208, 20 195, 20 170 L 20 135 C 20 105, 22 80, 25 75 Z"
                        fill="#1e293b"
                        stroke="#3b82f6"
                        strokeWidth="2.5"
                      />
                      {/* Front Windshield */}
                      <path
                        d="M 32 65 Q 50 55 68 65 L 65 95 Q 50 90 35 95 Z"
                        fill="#0f172a"
                        stroke="#60a5fa"
                        strokeWidth="1.5"
                      />
                      {/* Roof */}
                      <rect x="35" y="98" width="30" height="42" rx="4" fill="#141e2e" stroke="#475569" strokeWidth="1" />
                      {/* Rear Windshield */}
                      <path
                        d="M 34 145 Q 50 148 66 145 L 68 165 Q 50 170 32 165 Z"
                        fill="#0f172a"
                        stroke="#60a5fa"
                        strokeWidth="1.5"
                      />
                      {/* Headlights */}
                      <ellipse cx="32" cy="22" rx="4" ry="7" fill="#fde047" opacity="0.8" />
                      <ellipse cx="68" cy="22" rx="4" ry="7" fill="#fde047" opacity="0.8" />
                      {/* Taillights */}
                      <rect x="25" y="198" width="10" height="4" rx="1" fill="#f43f5e" />
                      <rect x="65" y="198" width="10" height="4" rx="1" fill="#f43f5e" />
                      {/* Front Arrow */}
                      <polygon points="50,2 45,8 55,8" fill="#3b82f6" />
                    </svg>
                    <span className="car-front-label">▲ FRENTE</span>
                  </div>

                  {/* 8 Angle Camera Buttons surrounding the car */}
                  {ANGLES_DATA.map((ang) => {
                    const isSelected = ang.id === selectedAngleId;
                    return (
                      <button
                        key={ang.id}
                        className={`camera-angle-pin pin-${ang.id} ${isSelected ? "selected" : ""}`}
                        onClick={() => setSelectedAngleId(ang.id)}
                        title={`${ang.name} (${ang.angle})`}
                      >
                        <span className="pin-deg">{ang.angle}</span>
                        <span className="pin-name-mini">{ang.name.split(" ")[0]}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Angle Details Card */}
                <div className="angle-detail-card">
                  <div className="angle-detail-header">
                    <div className="angle-badge-group">
                      <span className="angle-deg-pill">{selectedAngle.angle}</span>
                      <span className="angle-cat-badge">{selectedAngle.importance}</span>
                    </div>
                    <h4 className="angle-name-title">{selectedAngle.name}</h4>
                  </div>

                  <div className="angle-info-row">
                    <span className="angle-info-label">Objetivo da Imagem:</span>
                    <p className="angle-info-text">{selectedAngle.purpose}</p>
                  </div>

                  <div className="angle-info-row highlight-box">
                    <span className="angle-info-label">Dica de Posicionamento:</span>
                    <p className="angle-info-text">{selectedAngle.tip}</p>
                  </div>

                  <div className="angles-quick-list">
                    <span className="angles-quick-title">Selecionar outro ângulo:</span>
                    <div className="angles-quick-buttons">
                      {ANGLES_DATA.map((ang) => (
                        <button
                          key={ang.id}
                          className={`angle-quick-btn ${ang.id === selectedAngleId ? "active" : ""}`}
                          onClick={() => setSelectedAngleId(ang.id)}
                        >
                          {ang.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MODES COMPARISON */}
          {activeTab === "modes" && (
            <div className="guide-modes-view">
              <div className="modes-cards-grid">
                {/* Method 1: Apple Photogrammetry (Object Capture macOS) */}
                <div className="mode-card highlight">
                  <div className="mode-card-header">
                    <div className="badge badge-accent">Apple Nativo • 100% Grátis</div>
                    <h4 className="mode-title">Fotogrametria Real 360°</h4>
                    <span className="mode-subtitle">Reconstrói o carro exato usando o chip do seu Mac</span>
                  </div>

                  <div className="mode-stat-box">
                    <div className="mode-stat-item">
                      <span className="stat-num">30 a 80</span>
                      <span className="stat-label">Fotos recomendadas</span>
                    </div>
                    <div className="mode-stat-item">
                      <span className="stat-num">360°</span>
                      <span className="stat-label">Cobertura circular</span>
                    </div>
                    <div className="mode-stat-item">
                      <span className="stat-num">0</span>
                      <span className="stat-label">Créditos de nuvem</span>
                    </div>
                  </div>

                  <ul className="mode-rules-list">
                    <li>
                      <IconCheck size={14} className="text-emerald" />
                      <span>Dê 1 ou 2 passos ao redor do carro a cada disparo</span>
                    </li>
                    <li>
                      <IconCheck size={14} className="text-emerald" />
                      <span>Faça 2 voltas: 1 na altura da maçaneta e 1 na altura dos olhos</span>
                    </li>
                    <li>
                      <IconCheck size={14} className="text-emerald" />
                      <span>Você também pode enviar um vídeo 4K caminhando devagar ao redor</span>
                    </li>
                    <li>
                      <IconCheck size={14} className="text-emerald" />
                      <span>Gera a geometria real e extrai as cores fieis da lataria</span>
                    </li>
                  </ul>
                </div>

                {/* Method 2: Meshy Cloud AI */}
                <div className="mode-card">
                  <div className="mode-card-header">
                    <div className="badge badge-subtle">IA em Nuvem (Meshy)</div>
                    <h4 className="mode-title">Gerador 3D por IA</h4>
                    <span className="mode-subtitle">Gera a geometria do veículo a partir de 4 fotos principais</span>
                  </div>

                  <div className="mode-stat-box">
                    <div className="mode-stat-item">
                      <span className="stat-num">4</span>
                      <span className="stat-label">Fotos chave</span>
                    </div>
                    <div className="mode-stat-item">
                      <span className="stat-num">Ortogonal</span>
                      <span className="stat-label">Ângulos retos 90°</span>
                    </div>
                    <div className="mode-stat-item">
                      <span className="stat-num">API Key</span>
                      <span className="stat-label">Consome créditos</span>
                    </div>
                  </div>

                  <ul className="mode-rules-list">
                    <li>
                      <IconCheck size={14} className="text-accent" />
                      <span>1 foto da Frente reta (sem inclinação)</span>
                    </li>
                    <li>
                      <IconCheck size={14} className="text-accent" />
                      <span>1 foto da Traseira reta</span>
                    </li>
                    <li>
                      <IconCheck size={14} className="text-accent" />
                      <span>1 foto da Lateral Esquerda (perfil completo)</span>
                    </li>
                    <li>
                      <IconCheck size={14} className="text-accent" />
                      <span>1 foto da Lateral Direita (perfil completo)</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Do's and Don'ts comparison */}
              <div className="dos-donts-grid">
                <div className="dodont-card do-card">
                  <div className="dodont-header text-emerald">
                    <IconCheckCircle size={16} />
                    <span>O que fazer (Boas Práticas)</span>
                  </div>
                  <ul>
                    <li>Carro centralizado ocupando 80% do visor</li>
                    <li>Dia nublado ou sombra aberta com luz uniforme</li>
                    <li>Carro limpo para realçar reflexos e vincos</li>
                    <li>Sobreposição de 70% entre fotos adjacentes</li>
                    <li>Passos suaves e fotos em foco nítido</li>
                  </ul>
                </div>

                <div className="dodont-card dont-card">
                  <div className="dodont-header text-rose">
                    <IconAlertCircle size={16} />
                    <span>O que evitar (Erros Comuns)</span>
                  </div>
                  <ul>
                    <li>Sol do meio-dia que queima e reflete na lataria</li>
                    <li>Usar flash da câmera (cria reflexos falsos)</li>
                    <li>Cortar qualquer parte do parachoque ou teto</li>
                    <li>Mudar a posição do carro ou abrir portas</li>
                    <li>Pessoas ou carros se movimentando no fundo</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CHECKLIST */}
          {activeTab === "checklist" && (
            <div className="guide-checklist-view">
              <div className="checklist-intro-box">
                <div className="checklist-progress-text">
                  <span>Conferência Pré-Envio:</span>
                  <strong>{completedChecks} de {checklistItems.length} itens conferidos</strong>
                </div>
                <div className="checklist-bar-track">
                  <div
                    className="checklist-bar-fill"
                    style={{ width: `${(completedChecks / checklistItems.length) * 100}%` }}
                  />
                </div>
              </div>

              <div className="checklist-items-list">
                {checklistItems.map((item, idx) => {
                  const isChecked = !!checkedItems[idx];
                  return (
                    <div
                      key={idx}
                      className={`checklist-item-row ${isChecked ? "checked" : ""}`}
                      onClick={() => toggleCheck(idx)}
                    >
                      <div className={`checklist-checkbox ${isChecked ? "active" : ""}`}>
                        {isChecked && <IconCheck size={14} />}
                      </div>
                      <span className="checklist-item-text">{item}</span>
                    </div>
                  );
                })}
              </div>

              {completedChecks === checklistItems.length && (
                <div className="checklist-success-banner">
                  <IconCheckCircle size={20} className="text-emerald" />
                  <div>
                    <strong>Perfeito! Suas fotos estão no padrão profissional.</strong>
                    <p>Você pode carregar as fotos agora para gerar o modelo 3D com a máxima fidelidade.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer photo-guide-footer">
          <button className="btn-secondary" onClick={onClose}>
            Fechar Guia
          </button>
          {onSelectFilesClick && (
            <button
              className="btn-primary"
              onClick={() => {
                onClose();
                onSelectFilesClick();
              }}
            >
              <IconUpload size={16} />
              <span>Carregar Fotos Agora</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
