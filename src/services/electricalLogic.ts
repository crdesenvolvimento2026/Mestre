export interface CableData {
  section: number;
  capacity: {
    [method: string]: number; // Capacity in Amperes
  };
  resistance: number; // Ohm/km
}

export const CABLE_TABLE: CableData[] = [
  { section: 1.5, capacity: { 'B1': 17.5, 'B2': 16.5, 'C': 19.5 }, resistance: 12.1 },
  { section: 2.5, capacity: { 'B1': 24, 'B2': 23, 'C': 27 }, resistance: 7.41 },
  { section: 4, capacity: { 'B1': 32, 'B2': 30, 'C': 36 }, resistance: 4.61 },
  { section: 6, capacity: { 'B1': 41, 'B2': 38, 'C': 46 }, resistance: 3.08 },
  { section: 10, capacity: { 'B1': 57, 'B2': 52, 'C': 63 }, resistance: 1.83 },
  { section: 16, capacity: { 'B1': 76, 'B2': 69, 'C': 85 }, resistance: 1.15 },
  { section: 25, capacity: { 'B1': 101, 'B2': 90, 'C': 112 }, resistance: 0.727 },
  { section: 35, capacity: { 'B1': 125, 'B2': 111, 'C': 138 }, resistance: 0.524 },
  { section: 50, capacity: { 'B1': 151, 'B2': 133, 'C': 168 }, resistance: 0.387 },
  { section: 70, capacity: { 'B1': 192, 'B2': 168, 'C': 213 }, resistance: 0.268 },
  { section: 95, capacity: { 'B1': 232, 'B2': 201, 'C': 258 }, resistance: 0.193 },
  { section: 120, capacity: { 'B1': 269, 'B2': 232, 'C': 299 }, resistance: 0.153 },
];

export const TEMPERATURE_FACTORS: { [temp: number]: number } = {
  10: 1.22,
  15: 1.17,
  20: 1.12,
  25: 1.06,
  30: 1.00,
  35: 0.94,
  40: 0.87,
  45: 0.79,
  50: 0.71,
};

export const GROUPING_FACTORS: { [circuits: number]: number } = {
  1: 1.00,
  2: 0.80,
  3: 0.70,
  4: 0.65,
  5: 0.60,
  6: 0.57,
  7: 0.54,
  8: 0.52,
  9: 0.50,
};

export const BREAKER_RATINGS = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 70, 80, 100, 125];

export type SystemType = 'monofasico' | 'bifasico' | 'trifasico';
export type LoadType = 'iluminacao' | 'tomadas' | 'motor' | 'alimentador';

export interface CalcInput {
  systemType: SystemType;
  voltage: number;
  power: number;
  powerFactor: number;
  loadType: LoadType;
  length: number;
  method: string;
  temp: number;
  grouping: number;
  material: 'cobre' | 'aluminio';
  insulation: 'PVC' | 'EPR';
  breakerCurve: 'B' | 'C' | 'D';
  breakerIcn: number;
  breakerRating: number;
}

export interface CalcResult {
  current: number;
  cableSection: number;
  neutralSection: number;
  earthSection: number;
  conduitSize: string;
  breakerRating: number;
  breakerCurve: 'B' | 'C' | 'D';
  breakerIcn: number;
  voltageDrop: number;
  voltageDropPercent: number;
  shortCircuitCurrent: number;
  isConform: boolean;
  isIcnConform: boolean;
  izCorrected: number;
  notes: string[];
  bom: { item: string, quantity: string, estimatedPrice: number }[];
}

export function calculateElectrical(input: CalcInput): CalcResult {
  const { systemType, voltage, power, powerFactor, length, method, temp, grouping, loadType, breakerCurve, breakerIcn, breakerRating, material, insulation } = input;
  
  // 1. Calculate Current (Ib)
  let Ib = 0;
  if (systemType === 'trifasico') {
    Ib = power / (Math.sqrt(3) * voltage * powerFactor);
  } else {
    Ib = power / (voltage * powerFactor);
  }

  // 2. Correction Factors
  const ft = TEMPERATURE_FACTORS[temp] || 1.0;
  const fg = GROUPING_FACTORS[grouping] || 1.0;
  
  // Insulation Factor (EPR has higher capacity than PVC)
  const fInsulation = insulation === 'EPR' ? 1.25 : 1.0;
  // Material Factor (Aluminum has lower capacity than Copper)
  const fMaterial = material === 'aluminio' ? 0.78 : 1.0;
  
  const fTotal = ft * fg * fInsulation * fMaterial;

  // 3. Find Cable Section (Criterion: Ib <= In <= Iz)
  let selectedCable = CABLE_TABLE[0];
  let breaker = breakerRating;
  
  const getIz = (cable: CableData) => (cable.capacity[method] || cable.capacity['B1']) * fTotal;

  const findCable = (minIz: number) => {
    for (const cable of CABLE_TABLE) {
      const Iz = getIz(cable);
      if (Iz >= minIz) return cable;
    }
    return CABLE_TABLE[CABLE_TABLE.length - 1];
  };

  selectedCable = findCable(breaker);
  let Iz = getIz(selectedCable);

  // 4. Voltage Drop Calculation
  const calculateVD = (cable: CableData) => {
    let R = cable.resistance;
    if (material === 'aluminio') R *= 1.6; // Aluminum resistance is higher
    
    let dV = 0;
    if (systemType === 'trifasico') {
      dV = (Math.sqrt(3) * length * Ib * R) / 1000;
    } else {
      dV = (2 * length * Ib * R) / 1000;
    }
    const dVPercent = (dV / voltage) * 100;
    return { dV, dVPercent };
  };

  let vd = calculateVD(selectedCable);

  // 5. Voltage Drop Limits
  const limit = loadType === 'alimentador' ? 7 : 4;
  
  // Recalculate if VD exceeds limit
  while (vd.dVPercent > limit && CABLE_TABLE.indexOf(selectedCable) < CABLE_TABLE.length - 1) {
    selectedCable = CABLE_TABLE[CABLE_TABLE.indexOf(selectedCable) + 1];
    vd = calculateVD(selectedCable);
    Iz = getIz(selectedCable);
  }

  // 6. Neutral and Earth Sizing (NBR 5410)
  let neutralSection = selectedCable.section;
  if (systemType === 'trifasico' && selectedCable.section > 25) {
    neutralSection = selectedCable.section / 2;
    if (neutralSection < 16) neutralSection = 16;
  }

  let earthSection = selectedCable.section;
  if (selectedCable.section > 16 && selectedCable.section <= 35) {
    earthSection = 16;
  } else if (selectedCable.section > 35) {
    earthSection = selectedCable.section / 2;
  }

  // 7. Conduit Sizing (Simplified based on 40% fill rate)
  const totalArea = (selectedCable.section * (systemType === 'trifasico' ? 3 : 2)) + neutralSection + earthSection;
  let conduitSize = "3/4\"";
  if (totalArea > 150) conduitSize = "1\"";
  if (totalArea > 300) conduitSize = "1 1/4\"";
  if (totalArea > 500) conduitSize = "1 1/2\"";
  if (totalArea > 800) conduitSize = "2\"";

  // 8. Short Circuit Calculation
  const Isc = estimateShortCircuit(voltage, length, selectedCable.section);
  const isIcnConform = (breakerIcn * 1000) >= Isc;

  const isConform = vd.dVPercent <= limit && breaker <= Iz && isIcnConform;
  const notes = [];
  if (vd.dVPercent > limit) {
    notes.push(`Aviso: Queda de tensão calculada (${vd.dVPercent.toFixed(2)}%) excede o limite normativo de ${limit}% (NBR 5410). Mesmo com a maior bitola disponível, o limite não foi atendido.`);
  }
  if (breaker > Iz) {
    notes.push(`Erro: O disjuntor de ${breaker}A é maior que a capacidade do cabo corrigida (${Iz.toFixed(2)}A). Risco de sobrecarga.`);
  }
  if (breaker < Ib) {
    notes.push(`Erro: O disjuntor de ${breaker}A é menor que a corrente de projeto (${Ib.toFixed(2)}A). O disjuntor irá desarmar em condições normais.`);
  }
  if (!isIcnConform) {
    notes.push(`Perigo: Corrente de curto-circuito presumida (${Isc.toFixed(0)}A) excede a capacidade de interrupção do disjuntor (${breakerIcn}kA). Risco de explosão do dispositivo.`);
  }

  // 9. Breaker Curve Appropriateness Check
  if (loadType === 'motor' && breakerCurve === 'B') {
    notes.push("Recomendação: Para motores, utilize disjuntores Curva C ou D para evitar disparos indesejados na partida.");
  } else if (loadType === 'iluminacao' && breakerCurve === 'D') {
    notes.push("Recomendação: Para iluminação, Curva B ou C são mais adequadas. Curva D pode não atuar em curtos de baixa intensidade.");
  } else if (loadType === 'tomadas' && breakerCurve === 'B') {
    notes.push("Observação Técnica: Para circuitos de tomadas, a Curva B pode ser sensível a picos de partida. Sugere-se a utilização da Curva C.");
  }

  if (Ib > 100) notes.push("Corrente elevada (>100A), verifique necessidade de barramento ou cabos em paralelo.");

  // 10. BOM Generation
  const bom = [
    { item: `Cabo Flexível ${selectedCable.section}mm² ${material.toUpperCase()} ${insulation}`, quantity: `${length * (systemType === 'trifasico' ? 3 : 2)}m`, estimatedPrice: length * selectedCable.section * 0.5 },
    { item: `Cabo Flexível ${neutralSection}mm² (Neutro) Azul`, quantity: `${length}m`, estimatedPrice: length * neutralSection * 0.45 },
    { item: `Cabo Flexível ${earthSection}mm² (Terra) Verde`, quantity: `${length}m`, estimatedPrice: length * earthSection * 0.45 },
    { item: `Disjuntor DIN ${breaker}A Curva ${breakerCurve} ${breakerIcn}kA`, quantity: "1 un", estimatedPrice: 25 },
    { item: `Eletroduto Corrugado Reforçado ${conduitSize}`, quantity: `${length}m`, estimatedPrice: length * 5 }
  ];

  return {
    current: Ib,
    cableSection: selectedCable.section,
    neutralSection,
    earthSection,
    conduitSize,
    breakerRating: breaker,
    breakerCurve,
    breakerIcn,
    voltageDrop: vd.dV,
    voltageDropPercent: vd.dVPercent,
    shortCircuitCurrent: Isc,
    isConform,
    isIcnConform,
    izCorrected: Iz,
    notes,
    bom
  };
}

export interface MotorCalcInput {
  powerCV: number;
  voltage: number;
  efficiency: number;
  powerFactor: number;
  startingMethod: 'direta' | 'estrela-triangulo' | 'soft-starter';
}

export interface MotorCalcResult {
  nominalCurrent: number;
  startingCurrent: number;
  breaker: number;
  relay: number;
  contactor: string;
}

export function calculateMotor(input: MotorCalcInput): MotorCalcResult {
  const { powerCV, voltage, efficiency, powerFactor, startingMethod } = input;
  const powerW = powerCV * 735.5;
  const In = powerW / (Math.sqrt(3) * voltage * (efficiency / 100) * powerFactor);
  let Ip = In * 7;
  if (startingMethod === 'estrela-triangulo') Ip = In * 2.3;
  if (startingMethod === 'soft-starter') Ip = In * 3;
  const breaker = BREAKER_RATINGS.find(r => r >= In * 1.25) || 125;
  const relay = In * 1.1;
  return {
    nominalCurrent: In,
    startingCurrent: Ip,
    breaker,
    relay,
    contactor: In < 9 ? 'CWM9' : In < 12 ? 'CWM12' : In < 18 ? 'CWM18' : 'CWM25'
  };
}

export interface QDCCalcInput {
  circuits: { id: number, current: number, type: string }[];
}

export interface QDCCalcResult {
  totalCurrent: number;
  mainBreaker: number;
  drRating: number;
  dpsRating: string;
  busbarCurrent: number;
  phaseBalance: { phase: string, current: number }[];
}

export interface SPDAInput {
  height: number;
  width: number;
  length: number;
  riskLevel: 1 | 2 | 3 | 4;
}

export interface SPDAResult {
  protectionRadius: number;
  downConductorSpacing: number;
  groundingRingDepth: number;
  meshSize: string;
}

export interface SolarInput {
  monthlyConsumption: number;
  solarIrradiation: number; // kWh/m²/day
  panelPower: number; // Wp
}

export interface SolarResult {
  estimatedPanels: number;
  systemPower: number;
  monthlyGeneration: number;
  estimatedArea: number;
}

export function calculateSPDA(input: SPDAInput): SPDAResult {
  const { riskLevel } = input;
  const spacing = [10, 15, 20, 25][riskLevel - 1];
  const mesh = [`5x5m`, `10x10m`, `15x15m`, `20x20m`][riskLevel - 1];
  
  return {
    protectionRadius: input.height * 1.5, // Simplified
    downConductorSpacing: spacing,
    groundingRingDepth: 0.5,
    meshSize: mesh
  };
}

export function calculateSolar(input: SolarInput): SolarResult {
  const { monthlyConsumption, solarIrradiation, panelPower } = input;
  const dailyConsumption = monthlyConsumption / 30;
  const systemPowerKW = (dailyConsumption / solarIrradiation) / 0.8; // 0.8 efficiency factor
  const panels = Math.ceil((systemPowerKW * 1000) / panelPower);
  
  return {
    estimatedPanels: panels,
    systemPower: systemPowerKW,
    monthlyGeneration: systemPowerKW * solarIrradiation * 30 * 0.8,
    estimatedArea: panels * 2 // 2m² per panel
  };
}

export function calculateQDC(input: QDCCalcInput): QDCCalcResult {
  const totalCurrent = input.circuits.reduce((acc, c) => acc + c.current, 0);
  const mainBreaker = BREAKER_RATINGS.find(r => r >= totalCurrent * 0.8) || 125;
  
  // Simplified Phase Balancing
  const phases = [
    { phase: 'R', current: 0 },
    { phase: 'S', current: 0 },
    { phase: 'T', current: 0 }
  ];
  
  input.circuits.sort((a, b) => b.current - a.current).forEach((c, i) => {
    phases[i % 3].current += c.current;
  });

  return {
    totalCurrent,
    mainBreaker,
    drRating: mainBreaker,
    dpsRating: "20kA / 275V",
    busbarCurrent: mainBreaker * 1.25,
    phaseBalance: phases
  };
}

export function estimateShortCircuit(voltage: number, length: number, section: number): number {
  const cableResistance = (CABLE_TABLE.find(c => c.section === section)?.resistance || 1) * (length / 1000);
  return voltage / cableResistance;
}
