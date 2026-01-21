import React, { useState, useMemo, useCallback } from 'react';
import { Calculator } from './components/Calculator';
import { ResultTable } from './components/ResultTable';
import { FlangeDiagram } from './components/FlangeDiagram';
import { BoltLoadTable } from './components/BoltLoadTable';
import { TEMA_BOLT_DATA, GASKET_RING_TABLE, ASME_BOLT_MATERIALS, BOLT_TEMP_STEPS, GASKET_TYPES, WHC_MAX_PITCH_TABLE, HYDRAULIC_TENSIONING_DATA, ASME_SHELL_MATERIALS } from './constants';
import { CalculationResults, FlangeInputs } from './types';

interface SavedRecord {
  id: string;
  originalInputs: FlangeInputs; // Store original inputs to allow full restoration
  itemNo: string;
  part: string;
  id_mm: number;
  g0: number;
  g1: number;
  bcd: number;
  flangeOd: number;
  boltSize: string;
  boltEa: number;
  boltMaterial: string;
  hasOuterRing: boolean;
  hasInnerRing: boolean;
  gasketRod: number;
  gasketOd: number;
  gasketId: number;
  gasketRid: number;
  gasketType: string;
}

const toMpa = (p: number, unit: string): number => {
  switch (unit) {
    case 'Bar': return p * 0.1;
    case 'PSI': return p * 0.00689476;
    case 'kg/cm²': return p * 0.0980665;
    default: return p;
  }
};

const toCelsius = (t: number, unit: string): number => {
  switch (unit) {
    case '°F': return (t - 32) * 5 / 9;
    case 'K': return t - 273.15;
    default: return t;
  }
};

const interpolateStress = (temp: number, stressCurve: (number | null)[]): number => {
  const cleanCurve = stressCurve.map(s => s || 0);
  if (temp <= BOLT_TEMP_STEPS[0]) return cleanCurve[0];
  if (temp >= BOLT_TEMP_STEPS[BOLT_TEMP_STEPS.length - 1]) return cleanCurve[cleanCurve.length - 1];

  for (let i = 0; i < BOLT_TEMP_STEPS.length - 1; i++) {
    const t1 = BOLT_TEMP_STEPS[i];
    const t2 = BOLT_TEMP_STEPS[i + 1];
    if (temp >= t1 && temp <= t2) {
      const s1 = cleanCurve[i];
      const s2 = cleanCurve[i + 1] || s1;
      return s1 + ((s2 - s1) * (temp - t1)) / (t2 - t1);
    }
  }
  return cleanCurve[0];
};

const calculateAutoG0 = (currentInputs: Partial<FlangeInputs>): number => {
  const shellMatId = currentInputs.shellMaterial || ASME_SHELL_MATERIALS[0].id;
  const shellMat = ASME_SHELL_MATERIALS.find(m => m.id === shellMatId) || ASME_SHELL_MATERIALS[0];
  const temp = currentInputs.designTemp ?? 100;
  const tempU = currentInputs.tempUnit || '°C';
  const press = currentInputs.designPressure ?? 1.0;
  const pressU = currentInputs.pressureUnit || 'MPa';
  const id = currentInputs.insideDia ?? 300;
  const corr = currentInputs.corrosionAllowance ?? 0;
  const jointEff = currentInputs.jointEfficiency ?? 1.0;

  const shellStress = interpolateStress(toCelsius(temp, tempU), shellMat.stresses);
  const pMpa = toMpa(press, pressU);
  
  const denom = (shellStress * jointEff - 0.6 * pMpa);
  const autoG0 = (pMpa * (id + 2 * corr) / 2) / (denom > 0 ? denom : 1) + corr;
  return Math.ceil(autoG0);
};

const initialG0 = calculateAutoG0({
  designTemp: 100,
  tempUnit: '°C',
  designPressure: 1.0,
  pressureUnit: 'MPa',
  insideDia: 300,
  corrosionAllowance: 0,
  jointEfficiency: 1.0,
  shellMaterial: ASME_SHELL_MATERIALS[0].id
});

const initialInputs: FlangeInputs = {
  itemNo: 'E-101',
  partName: 'CC FLG',
  boltSize: 0.75,
  boltCount: 12,
  insideDia: 300,
  g0: initialG0,
  g1: Math.ceil(initialG0 * 1.3 / 3 + initialG0),
  cClearance: 2.5,
  shellGapA: 3.0,
  gasketSeatingWidth: 15,
  hasInnerRing: true,
  hasOuterRing: true,
  innerRingWidthManual: 0,
  outerRingWidthManual: 0,
  useManualOverride: false,
  actualBCD: 0,
  actualOD: 0,
  manualSeatingID: 0,
  manualSeatingOD: 0,
  manualM: 0,
  manualY: 0,
  manualPassM: 0,
  manualPassY: 0,
  designTemp: 100,
  tempUnit: '°C',
  designPressure: 1.0,
  pressureUnit: 'MPa',
  shellMaterial: ASME_SHELL_MATERIALS[0].id,
  jointEfficiency: 1,
  corrosionAllowance: 0,
  boltMaterial: ASME_BOLT_MATERIALS[7].id,
  passPartitionLength: 0,
  passPartitionWidth: 0,
  gasketType: GASKET_TYPES[12].id,
  passGasketType: GASKET_TYPES[12].id,
  facingSketch: '1a: Flat Face / Groove',
  useHydraulicTensioning: false,
  usePcc1Check: false,
  sgT: 0,
  sgMinS: 0,
  sgMinO: 0,
  sgMax: 0,
  sbMax: 0,
  sbMin: 0,
  sfMax: 0,
  phiFMax: 0.32,
  phiGMax: 1,
  g: 0.7,
  passPartAreaReduction: 50,
};

const App: React.FC = () => {
  const [inputs, setInputs] = useState<FlangeInputs>(initialInputs);
  const [isFixedSizeSearch, setIsFixedSizeSearch] = useState(false);
  const [savedRecords, setSavedRecords] = useState<SavedRecord[]>([]);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

  const calculateFullResults = useCallback((currentInputs: FlangeInputs): CalculationResults => {
    const boltData = TEMA_BOLT_DATA.find(b => b.size === currentInputs.boltSize) || TEMA_BOLT_DATA[0];
    const tensionData = HYDRAULIC_TENSIONING_DATA.find(t => t.size === currentInputs.boltSize);
    const ringConfig = GASKET_RING_TABLE.find(r => currentInputs.insideDia >= r.min && currentInputs.insideDia <= r.max) || GASKET_RING_TABLE[GASKET_RING_TABLE.length - 1];

    const innerRingWidth = currentInputs.hasInnerRing ? (currentInputs.innerRingWidthManual || ringConfig.irMin) : 0;
    const outerRingWidth = currentInputs.hasOuterRing ? (currentInputs.outerRingWidthManual || ringConfig.orMin) : 0;
    const effectiveC = currentInputs.cClearance || 2.5;
    const shellGapA = currentInputs.shellGapA !== undefined ? currentInputs.shellGapA : 3.0;
    const bConst = 1.5; 

    const roundedHoleSize = Math.ceil(boltData.holeSize);

    const effectiveBMin = (currentInputs.useHydraulicTensioning && tensionData) 
      ? Math.max(boltData.B_min, tensionData.B_ten) 
      : boltData.B_min;
    
    const bcdMethod1 = Math.ceil((effectiveBMin * 25.4 * currentInputs.boltCount) / Math.PI);
    const radialDistance = boltData.R * 25.4;
    const bcdMethod2 = Math.ceil(currentInputs.insideDia + (2 * currentInputs.g1) + (2 * radialDistance));

    const baseBCDForAutoGasket = Math.max(bcdMethod1, bcdMethod2);

    const autoSeatingOD_BCD = baseBCDForAutoGasket - roundedHoleSize - (2 * effectiveC) - (2 * bConst) - (2 * outerRingWidth);
    const autoSeatingOD_Shell = currentInputs.insideDia + (2 * shellGapA) + (2 * innerRingWidth) + (2 * currentInputs.gasketSeatingWidth);

    const autoSeatingOD = Math.max(autoSeatingOD_BCD, autoSeatingOD_Shell);
    const autoSeatingID = autoSeatingOD - (2 * currentInputs.gasketSeatingWidth);

    const seatingID = currentInputs.manualSeatingID !== 0 ? currentInputs.manualSeatingID : autoSeatingID;
    const seatingOD = currentInputs.manualSeatingOD !== 0 ? currentInputs.manualSeatingOD : autoSeatingOD;
    
    const gasketOD = seatingOD + (currentInputs.hasOuterRing ? (2 * outerRingWidth) : 0);
    const gasketID = seatingID - (currentInputs.hasInnerRing ? (2 * innerRingWidth) : 0);

    const bcdMethod3 = gasketOD + (2 * bConst) + (2 * effectiveC) + roundedHoleSize;
    const bcdTema = Math.max(bcdMethod1, bcdMethod2, bcdMethod3);
    const selectedBcdSource = bcdTema === bcdMethod1 ? 1 : (bcdTema === bcdMethod2 ? 2 : 3);
    const finalBCD = currentInputs.actualBCD !== 0 ? currentInputs.actualBCD : bcdTema;
    
    const edgeDistance = boltData.E * 25.4;
    const odTema = Math.ceil(finalBCD + (2 * edgeDistance));
    const finalOD = currentInputs.actualOD !== 0 ? currentInputs.actualOD : odTema;

    const gType = GASKET_TYPES.find(g => g.id === currentInputs.gasketType) || GASKET_TYPES[0];
    const gasketM = currentInputs.manualM !== 0 ? currentInputs.manualM : gType.m;
    const gasketY = currentInputs.manualY !== 0 ? currentInputs.manualY : gType.y;

    const passGType = GASKET_TYPES.find(g => g.id === currentInputs.passGasketType) || gType;
    const passM = currentInputs.manualPassM !== 0 ? currentInputs.manualPassM : passGType.m;
    const passY = currentInputs.manualPassY !== 0 ? currentInputs.manualPassY : passGType.y;

    const boltNominalDia = currentInputs.boltSize * 25.4;
    const geometricPitch = (Math.PI * finalBCD) / currentInputs.boltCount;
    const boltSpacingMin = effectiveBMin * 25.4;
    
    const whcMaxPitch = WHC_MAX_PITCH_TABLE[currentInputs.boltSize] || (2.5 * boltNominalDia + 12);
    const maxBoltSpacing = whcMaxPitch;

    const nWidth = currentInputs.gasketSeatingWidth;
    let b0Width = nWidth / 2;
    if (currentInputs.facingSketch.startsWith('1a') || currentInputs.facingSketch.startsWith('1b')) {
      b0Width = nWidth / 2;
    } else if (currentInputs.facingSketch.startsWith('1c') || currentInputs.facingSketch.startsWith('1d')) {
      b0Width = nWidth / 4;
    } else if (currentInputs.facingSketch.startsWith('2')) {
      b0Width = nWidth / 8;
    }

    const Cul = 25.4; 
    const bWidth = b0Width > 6 ? 0.5 * Cul * Math.sqrt(b0Width / Cul) : b0Width;
    const gMeanDia = b0Width > 6 ? seatingOD - (2 * bWidth) : (seatingID + seatingOD) / 2;

    const pMpa = toMpa(currentInputs.designPressure, currentInputs.pressureUnit);
    const hForce = 0.785 * Math.pow(gMeanDia, 2) * pMpa;
    const hpForce = 2 * pMpa * (bWidth * Math.PI * gMeanDia * gasketM + currentInputs.passPartitionWidth * currentInputs.passPartitionLength * passM);
    const wm1 = hForce + hpForce;
    const wm2 = (Math.PI * bWidth * gMeanDia * (gasketY * 0.00689476)) + (currentInputs.passPartitionWidth * currentInputs.passPartitionLength * (passY * 0.00689476));

    const mat = ASME_BOLT_MATERIALS.find(m => m.id === currentInputs.boltMaterial) || ASME_BOLT_MATERIALS[0];
    const ambientAllowableStress = mat.stresses[1] || 0;
    const designAllowableStress = interpolateStress(toCelsius(currentInputs.designTemp, currentInputs.tempUnit), mat.stresses);

    const totalBoltArea = boltData.tensileArea * currentInputs.boltCount;
    const reqAreaOperating = wm1 / designAllowableStress;
    const reqAreaSeating = wm2 / ambientAllowableStress;
    const requiredBoltArea = Math.max(reqAreaOperating, reqAreaSeating);

    return {
      bcdMethod1, bcdMethod2, bcdMethod3, selectedBcdSource,
      bcdTema, odTema, boltSpacingMin, maxBoltSpacing, 
      geometricPitch, actualBoltSpacing: maxBoltSpacing,
      spacingOk: geometricPitch >= boltSpacingMin && geometricPitch <= maxBoltSpacing,
      radialDistance, edgeDistance, effectiveC, shellGapA,
      gasketSeatingWidth: nWidth, innerRingWidth, outerRingWidth,
      gasketID, seatingID, seatingOD, gasketOD, finalBCD, finalOD,
      maxRaisedFace: finalBCD - roundedHoleSize - (2 * effectiveC) - (2 * bConst) - (2 * outerRingWidth), 
      boltHoleSize: roundedHoleSize,
      singleBoltArea: boltData.tensileArea, totalBoltArea,
      requiredBoltArea,
      totalBoltLoadAmbient: totalBoltArea * ambientAllowableStress,
      totalBoltLoadDesign: totalBoltArea * designAllowableStress,
      ambientAllowableStress, designAllowableStress,
      gasketM, gasketY, passM, passY, wm1, wm2, hForce, hpForce, gMeanDia, bWidth, b0Width, nWidth
    };
  }, []);

  const results = useMemo(() => {
    return calculateFullResults(inputs);
  }, [inputs, calculateFullResults]);
  
  const pccStatusInfo = useMemo(() => {
    if (!inputs.usePcc1Check) return { active: false, safe: true };

    const totalBoltRootArea = results.singleBoltArea * inputs.boltCount;
    const ringArea = (Math.PI / 4) * (Math.pow(results.seatingOD, 2) - Math.pow(results.seatingID, 2));
    const reducedPassArea = (inputs.passPartAreaReduction / 100) * inputs.passPartitionWidth * inputs.passPartitionLength;
    const totalAg = ringArea + reducedPassArea;

    const sbSelCalc = totalBoltRootArea > 0 ? (inputs.sgT * totalAg) / totalBoltRootArea : 0;
    const valA = Math.min(sbSelCalc, inputs.sbMax || Infinity);
    const valB = Math.max(valA, inputs.sbMin || 0);
    const valC = Math.min(valB, inputs.sfMax || Infinity);
    const sbSelFinal = Math.min(valA, valB, valC);

    const pMpa = toMpa(inputs.designPressure, inputs.pressureUnit);

    const step5Threshold = totalBoltRootArea > 0 ? inputs.sgMinS * (totalAg / totalBoltRootArea) : 0;
    const step6Numerator = (inputs.sgMinO * totalAg) + ((Math.PI / 4) * pMpa * Math.pow(results.seatingID, 2));
    const step6Denominator = (inputs.g || 1) * totalBoltRootArea;
    const step6Threshold = totalBoltRootArea > 0 ? step6Numerator / step6Denominator : 0;
    const step7Threshold = totalBoltRootArea > 0 ? inputs.sgMax * (totalAg / totalBoltRootArea) : Infinity;
    const step8Threshold = inputs.phiFMax > 0 ? inputs.sfMax * ((inputs.g || 1) / inputs.phiFMax) : Infinity;

    const isStep5Ok = sbSelFinal >= step5Threshold - 0.001;
    const isStep6Ok = sbSelFinal >= step6Threshold - 0.001;
    const isStep7Ok = inputs.sgMax === 0 ? true : (sbSelFinal <= step7Threshold + 0.001);
    const isStep8Ok = inputs.phiFMax === 0 ? true : (sbSelFinal <= step8Threshold + 0.001);

    return {
      active: true,
      safe: isStep5Ok && isStep6Ok && isStep7Ok && isStep8Ok
    };
  }, [inputs, results]);

  const requiredLoadN = Math.max(results.wm1, results.wm2);
  const availableLoadN = results.totalBoltLoadDesign;
  const marginPercent = ((availableLoadN - requiredLoadN) / requiredLoadN) * 100;
  const isSafe = availableLoadN >= requiredLoadN;

  const performSearch = (targetInputs: FlangeInputs, fixedSize: boolean) => {
    const optimizedTargetInputs = {
      ...targetInputs,
      useManualOverride: false,
      actualBCD: 0,
      actualOD: 0,
      manualSeatingID: 0,
      manualSeatingOD: 0
    };

    let bestSize = optimizedTargetInputs.boltSize;
    let bestCount = optimizedTargetInputs.boltCount;
    let minRequiredLoad = Infinity; 
    let found = false;

    const sizesToSearch = fixedSize 
      ? [optimizedTargetInputs.boltSize] 
      : TEMA_BOLT_DATA.filter(b => b.size >= 0.75).map(b => b.size);

    const counts = [4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80];

    for (const size of sizesToSearch) {
      for (const count of counts) {
        const testInputs = { ...optimizedTargetInputs, boltSize: size, boltCount: count };
        const testResults = calculateFullResults(testInputs);
        const req = Math.max(testResults.wm1, testResults.wm2);
        const avail = testResults.totalBoltLoadDesign;
        const margin = ((avail - req) / req) * 100;
        
        if (margin >= 0 && testResults.spacingOk) {
          if (req < minRequiredLoad) {
            minRequiredLoad = req;
            bestSize = size;
            bestCount = count;
            found = true;
          }
        }
      }
    }

    if (found) {
      setInputs(prev => ({ 
        ...prev, 
        boltSize: bestSize, 
        boltCount: bestCount,
        useManualOverride: false,
        actualBCD: 0,
        actualOD: 0,
        manualSeatingID: 0,
        manualSeatingOD: 0
      }));
      const finalTestInputs = { ...optimizedTargetInputs, boltSize: bestSize, boltCount: bestCount };
      const finalResults = calculateFullResults(finalTestInputs);
      const finalMargin = ((finalResults.totalBoltLoadDesign - Math.max(finalResults.wm1, finalResults.wm2)) / Math.max(finalResults.wm1, finalResults.wm2)) * 100;

      alert(`Optimization Completed!\n\nObjective: Minimize Required Load\nSearch Mode: ${fixedSize ? 'Fixed Size Search' : 'Full Automatic Search'}\nResult:\nBolt Size: ${bestSize}"\nBolt Count: ${bestCount} EA\nMin Required Load: ${(minRequiredLoad / 1000).toFixed(1)} kN\nDesign Margin: +${finalMargin.toFixed(2)}%\n\nGasket size has been reset to the optimized default.`);
    } else {
      alert(`No valid configuration found. ${fixedSize ? `(Current Bolt Size: ${optimizedTargetInputs.boltSize}")` : 'Tried all bolt sizes.'}\nTry adjusting pressure/temp or manually increasing bolt size.`);
    }
  };

  const handleOptimize = () => performSearch(inputs, isFixedSizeSearch);

  const handleResetAndOptimize = () => {
    setIsFixedSizeSearch(false);
    performSearch(inputs, false);
  };

  const handleInputChange = (updatedInputs: FlangeInputs, changedFieldName: string) => {
    let finalInputs = { ...updatedInputs };

    const g0Triggers = ['designTemp', 'tempUnit', 'designPressure', 'pressureUnit', 'shellMaterial', 'jointEfficiency', 'insideDia', 'corrosionAllowance'];
    if (g0Triggers.includes(changedFieldName)) {
       const autoG0 = calculateAutoG0(finalInputs);
       finalInputs.g0 = autoG0;
       finalInputs.g1 = Math.ceil(autoG0 * 1.3 / 3 + autoG0);
    }

    const designConditions = ['designTemp', 'tempUnit', 'designPressure', 'pressureUnit', 'shellMaterial', 'boltMaterial', 'gasketType', 'passGasketType', 'facingSketch', 'jointEfficiency', 'corrosionAllowance'];
    const geometryTriggers = ['boltSize', 'insideDia'];

    if (designConditions.includes(changedFieldName)) {
      setIsFixedSizeSearch(false);
    } else if (geometryTriggers.includes(changedFieldName)) {
      setIsFixedSizeSearch(true);
    }

    setInputs(finalInputs);
  };

  const handleSaveToList = () => {
    const newRecord: SavedRecord = {
      id: Date.now().toString(),
      originalInputs: { ...inputs },
      itemNo: inputs.itemNo || '-',
      part: inputs.partName || '-',
      id_mm: inputs.insideDia,
      g0: inputs.g0,
      g1: inputs.g1,
      bcd: Math.round(results.finalBCD),
      flangeOd: Math.round(results.finalOD),
      boltSize: `${inputs.boltSize}"`,
      boltEa: inputs.boltCount,
      boltMaterial: inputs.boltMaterial,
      hasOuterRing: inputs.hasOuterRing,
      hasInnerRing: inputs.hasInnerRing,
      gasketRod: parseFloat(results.gasketOD.toFixed(1)),
      gasketOd: parseFloat(results.seatingOD.toFixed(1)),
      gasketId: parseFloat(results.seatingID.toFixed(1)),
      gasketRid: parseFloat(results.gasketID.toFixed(1)),
      gasketType: inputs.gasketType
    };
    setSavedRecords(prev => [...prev, newRecord]);
    setEditingRecordId(null); // Clear editing state after save
  };

  const handleEditSave = () => {
    if (!editingRecordId) {
      alert('Please select a record to edit from the summary list first.');
      return;
    }

    const updatedRecord: SavedRecord = {
      id: editingRecordId,
      originalInputs: { ...inputs },
      itemNo: inputs.itemNo || '-',
      part: inputs.partName || '-',
      id_mm: inputs.insideDia,
      g0: inputs.g0,
      g1: inputs.g1,
      bcd: Math.round(results.finalBCD),
      flangeOd: Math.round(results.finalOD),
      boltSize: `${inputs.boltSize}"`,
      boltEa: inputs.boltCount,
      boltMaterial: inputs.boltMaterial,
      hasOuterRing: inputs.hasOuterRing,
      hasInnerRing: inputs.hasInnerRing,
      gasketRod: parseFloat(results.gasketOD.toFixed(1)),
      gasketOd: parseFloat(results.seatingOD.toFixed(1)),
      gasketId: parseFloat(results.seatingID.toFixed(1)),
      gasketRid: parseFloat(results.gasketID.toFixed(1)),
      gasketType: inputs.gasketType
    };

    setSavedRecords(prev => prev.map(rec => rec.id === editingRecordId ? updatedRecord : rec));
    setEditingRecordId(null);
    alert('Record Updated Successfully!');
  };

  const removeRecord = (id: string) => {
    setSavedRecords(prev => prev.filter(r => r.id !== id));
    if (editingRecordId === id) setEditingRecordId(null);
  };

  const editRecord = (record: SavedRecord) => {
    setInputs(record.originalInputs);
    setEditingRecordId(record.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 font-sans text-slate-900">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-sky-600 rounded-xl flex items-center justify-center shadow-lg">
              <i className="fa-solid fa-wrench text-white text-2xl"></i>
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">Flange Genie</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TEMA RCB-11.2 & ASME APP.2 Engineering Calculator</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          <div className="xl:col-span-4">
            <Calculator 
              inputs={inputs} 
              onInputChange={handleInputChange} 
              onOptimize={handleOptimize} 
              onResetOptimize={handleResetAndOptimize}
              results={results} 
            />
          </div>
          <div className="xl:col-span-8 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <ResultTable inputs={inputs} results={results} />
              
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center">
                <div className="flex justify-between items-center mb-4 border-b pb-3 w-full">
                  <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 uppercase tracking-tighter">
                    <i className="fa-solid fa-square-poll-vertical text-sky-600"></i> FINAL REPORT
                  </h2>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleSaveToList}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-md flex items-center gap-2 min-w-[100px] justify-center"
                    >
                      <i className="fa-solid fa-floppy-disk"></i> SAVE
                    </button>
                    <button 
                      onClick={handleEditSave}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-md flex items-center gap-2 border-2 min-w-[100px] justify-center ${
                        editingRecordId 
                        ? 'bg-sky-600 border-sky-400 hover:bg-sky-700 text-white' 
                        : 'bg-slate-100 border-slate-200 text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      <i className="fa-solid fa-file-pen"></i> EDIT SAVE
                    </button>
                  </div>
                </div>
                
                <div className="p-1">
                  <FlangeDiagram inputs={inputs} results={results} />
                </div>
                
                <div className="w-full mt-6 bg-slate-900 rounded-3xl p-6 text-white shadow-2xl space-y-4">
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex justify-between items-center px-4 py-3.5 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-sky-500/10 flex items-center justify-center border border-sky-500/10">
                          <i className="fa-solid fa-arrows-left-right text-sky-400 text-sm"></i>
                        </div>
                        <span className="text-[10px] font-black text-sky-400 tracking-widest uppercase">Result B.C.D</span>
                      </div>
                      <span className="text-2xl font-black tabular-nums leading-none flex items-baseline gap-1.5">
                        {results.finalBCD.toFixed(1)} 
                        <small className="text-[10px] font-bold opacity-40">MM</small>
                      </span>
                    </div>

                    <div className="flex justify-between items-center px-4 py-3.5 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/10">
                          <i className="fa-solid fa-expand text-amber-400 text-sm"></i>
                        </div>
                        <span className="text-[10px] font-black text-amber-400 tracking-widest uppercase">Final Flange O.D</span>
                      </div>
                      <span className="text-2xl font-black tabular-nums leading-none flex items-baseline gap-1.5">
                        {results.finalOD.toFixed(0)} 
                        <small className="text-[10px] font-bold opacity-40">MM</small>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 py-1">
                    <div className="h-px bg-white/10 flex-1"></div>
                    <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.3em]">Load Analysis</span>
                    <div className="h-px bg-white/10 flex-1"></div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div className={`flex justify-between items-center px-4 py-4 rounded-2xl border transition-all ${isSafe ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                      <div className="flex items-center gap-4">
                         <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${isSafe ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-red-500 shadow-red-500/20'}`}>
                           <i className={`fa-solid ${isSafe ? 'fa-check' : 'fa-xmark'} text-xl text-white`}></i>
                         </div>
                         <div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-white/50 block mb-0.5">Status</span>
                            <h4 className={`text-sm font-black uppercase tracking-tight ${isSafe ? 'text-emerald-400' : 'text-red-400'}`}>
                              {isSafe ? 'Acceptable' : 'Recheck Load'}
                            </h4>
                         </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-black uppercase tracking-widest text-white/50 block mb-0.5">Margin</span>
                        <span className={`text-lg font-black tabular-nums ${marginPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {marginPercent >= 0 ? '+' : ''}{marginPercent.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {inputs.usePcc1Check && (
                      <div className={`flex justify-between items-center px-4 py-4 rounded-2xl border transition-all ${pccStatusInfo.safe ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                        <div className="flex items-center gap-4">
                           <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${pccStatusInfo.safe ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-red-500 shadow-red-500/20'}`}>
                             <i className={`fa-solid ${pccStatusInfo.safe ? 'fa-check' : 'fa-xmark'} text-xl text-white`}></i>
                           </div>
                           <div>
                              <span className="text-[9px] font-black uppercase tracking-widest text-white/50 block mb-0.5">PCC-1 Summary</span>
                              <h4 className={`text-sm font-black uppercase tracking-tight ${pccStatusInfo.safe ? 'text-emerald-400' : 'text-red-400'}`}>
                                {pccStatusInfo.safe ? 'PCC OK' : 'Recheck PCC'}
                              </h4>
                           </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 py-1">
                    <div className="h-px bg-white/10 flex-1"></div>
                    <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.3em]">Bolt Root Area Analysis</span>
                    <div className="h-px bg-white/10 flex-1"></div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="px-4 py-6 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center">
                      <span className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-3">Allowable Bolt Root Area</span>
                      <span className="text-xl font-black text-blue-400 tabular-nums">
                        {results.totalBoltArea.toFixed(1)} <small className="text-[10px] opacity-70">mm²</small>
                      </span>
                    </div>
                    <div className="px-4 py-6 bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center">
                      <span className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-3">Required Bolt Root Area</span>
                      <span className="text-xl font-black text-pink-400 tabular-nums">
                        {results.requiredBoltArea.toFixed(1)} <small className="text-[10px] opacity-70">mm²</small>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <BoltLoadTable inputs={inputs} results={results} />
          </div>
        </div>

        {savedRecords.length > 0 && (
          <section className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center border-b border-slate-700">
              <h3 className="text-lg font-black text-white flex items-center gap-3 uppercase tracking-tighter">
                <i className="fa-solid fa-list-check text-sky-400"></i> Calculation Summary List
              </h3>
              <div className="flex items-center gap-2">
                 <button 
                  onClick={() => { setSavedRecords([]); setEditingRecordId(null); }}
                  className="text-[9px] font-black text-slate-400 hover:text-white uppercase tracking-widest px-3 py-1 border border-slate-700 rounded-md transition-all"
                 >
                   Clear All
                 </button>
                 <button 
                  onClick={() => window.print()}
                  className="bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all"
                 >
                   <i className="fa-solid fa-print"></i> PRINT
                 </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-slate-300 text-[10px] font-bold text-center">
                <thead className="bg-white">
                  <tr>
                    <th rowSpan={2} className="border border-slate-300 px-2 py-1 uppercase bg-slate-50">ITEM NO</th>
                    <th rowSpan={2} className="border border-slate-300 px-2 py-1 uppercase bg-slate-50">PART</th>
                    <th colSpan={3} className="border border-slate-300 px-2 py-1 uppercase bg-emerald-100/50">FLANGE</th>
                    <th colSpan={4} className="border border-slate-300 px-2 py-1 uppercase bg-pink-100/50">GASKET</th>
                    <th colSpan={2} className="border border-slate-300 px-2 py-1 uppercase bg-emerald-100/50">FLANGE</th>
                    <th colSpan={3} className="border border-slate-300 px-2 py-1 uppercase bg-slate-100">BOLT</th>
                    <th rowSpan={2} className="border border-slate-300 px-2 py-1 uppercase bg-slate-50 min-w-[150px]">TYPE</th>
                    <th rowSpan={3} className="border border-slate-300 px-2 py-1 uppercase bg-slate-50">ACTION</th>
                  </tr>
                  <tr>
                    <th className="border border-slate-300 px-2 py-1 uppercase">OD</th>
                    <th className="border border-slate-300 px-2 py-1 uppercase">ID</th>
                    <th className="border border-slate-300 px-2 py-1 uppercase">BCD</th>
                    <th className="border border-slate-300 px-2 py-1 uppercase">ROD</th>
                    <th className="border border-slate-300 px-2 py-1 uppercase">OD</th>
                    <th className="border border-slate-300 px-2 py-1 uppercase">ID</th>
                    <th className="border border-slate-300 px-2 py-1 uppercase">RID</th>
                    <th className="border border-slate-300 px-2 py-1 uppercase">g0</th>
                    <th className="border border-slate-300 px-2 py-1 uppercase">g1</th>
                    <th className="border border-slate-300 px-2 py-1 uppercase">SIZE</th>
                    <th className="border border-slate-300 px-2 py-1 uppercase">EA</th>
                    <th className="border border-slate-300 px-2 py-1 uppercase">MATERIAL</th>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <th colSpan={2} className="border border-slate-300"></th>
                    <th colSpan={9} className="border border-slate-300 px-2 py-0 text-[8px] italic text-slate-500 font-bold lowercase">(mm)</th>
                    <th colSpan={4} className="border border-slate-300"></th>
                  </tr>
                </thead>
                <tbody>
                  {savedRecords.map(record => (
                    <tr key={record.id} className={`border-b border-slate-300 transition-colors ${editingRecordId === record.id ? 'bg-indigo-50' : 'hover:bg-slate-50/50'}`}>
                      <td className="border border-slate-300 px-2 py-1.5 text-slate-900">{record.itemNo}</td>
                      <td className="border border-slate-300 px-2 py-1.5 text-slate-900">{record.part}</td>
                      <td className="border border-slate-300 px-2 py-1.5 tabular-nums font-black text-amber-600">{record.flangeOd}</td>
                      <td className="border border-slate-300 px-2 py-1.5 tabular-nums">{record.id_mm}</td>
                      <td className="border border-slate-300 px-2 py-1.5 tabular-nums font-black text-sky-600">{record.bcd}</td>
                      <td className="border border-slate-300 px-2 py-1.5 tabular-nums">{record.hasOuterRing ? record.gasketRod : '-'}</td>
                      <td className="border border-slate-300 px-2 py-1.5 tabular-nums">{record.gasketOd}</td>
                      <td className="border border-slate-300 px-2 py-1.5 tabular-nums">{record.gasketId}</td>
                      <td className="border border-slate-300 px-2 py-1.5 tabular-nums">{record.hasInnerRing ? record.gasketRid : '-'}</td>
                      <td className="border border-slate-300 px-2 py-1.5 tabular-nums">{record.g0}</td>
                      <td className="border border-slate-300 px-2 py-1.5 tabular-nums">{record.g1}</td>
                      <td className="border border-slate-300 px-2 py-1.5 font-mono">{record.boltSize}</td>
                      <td className="border border-slate-300 px-2 py-1.5 tabular-nums">{record.boltEa}</td>
                      <td className="border border-slate-300 px-2 py-1.5 text-left text-[8px] leading-tight max-w-[120px] truncate" title={record.boltMaterial}>{record.boltMaterial}</td>
                      <td className="border border-slate-300 px-2 py-1.5 text-left text-[8px] leading-tight max-w-[200px] whitespace-normal" title={record.gasketType}>{record.gasketType}</td>
                      <td className="border border-slate-300 px-2 py-1.5">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => editRecord(record)} className="text-sky-500 hover:text-sky-700 transition-colors p-1"><i className="fa-solid fa-pen-to-square"></i></button>
                          <button onClick={() => removeRecord(record.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1"><i className="fa-solid fa-trash-can"></i></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default App;
