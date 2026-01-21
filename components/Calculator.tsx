import React from 'react';
import { FlangeInputs, CalculationResults } from '../types';
import { TEMA_BOLT_DATA, GASKET_RING_TABLE, ASME_BOLT_MATERIALS, GASKET_TYPES, ASME_PLATE_MATERIALS } from '../constants';

interface Props {
  inputs: FlangeInputs;
  onInputChange: (updatedInputs: FlangeInputs, changedFieldName: string) => void;
  onOptimize?: () => void;
  onResetOptimize?: () => void;
  results: CalculationResults;
}

export const Calculator: React.FC<Props> = ({ inputs, onInputChange, onOptimize, onResetOptimize, results }) => {
  const updatePcc1Values = (gasketType: string, currentInputs: FlangeInputs) => {
    const typeLower = gasketType.toLowerCase();
    let nextInputs = { ...currentInputs };

    if (typeLower.includes('grooved')) {
      nextInputs.sgMax = 380;
      nextInputs.sgMinS = 140;
      nextInputs.sgMinO = 97;
    } else if (typeLower.includes('corruga')) {
      nextInputs.sgMax = 275;
      nextInputs.sgMinS = 140;
      nextInputs.sgMinO = 97;
    } else if (typeLower.includes('spiral')) {
      nextInputs.sgMax = 0;
      nextInputs.sgMinS = 140;
      nextInputs.sgMinO = 97;
    }

    const mat = ASME_BOLT_MATERIALS.find(m => m.id === nextInputs.boltMaterial);
    if (mat && mat.minYield) {
      // Calculate with 1 decimal place precision
      nextInputs.sbMax = Math.round(mat.minYield * 0.7 * 10) / 10;
      nextInputs.sbMin = Math.round(mat.minYield * 0.4 * 10) / 10;
    }

    // Set defaults if currently zero
    if (!nextInputs.phiFMax) nextInputs.phiFMax = 0.32;
    if (!nextInputs.g) nextInputs.g = 0.7;
    if (!nextInputs.passPartAreaReduction) nextInputs.passPartAreaReduction = 50;

    return nextInputs;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    let nextInputs = { ...inputs };

    if (type === 'checkbox') {
      nextInputs = {
        ...nextInputs,
        [name]: (e.target as HTMLInputElement).checked
      };
    } else if (['tempUnit', 'pressureUnit', 'shellMaterial', 'boltMaterial', 'gasketType', 'passGasketType', 'facingSketch', 'itemNo', 'partName'].includes(name)) {
      nextInputs = {
        ...nextInputs,
        [name]: value
      };
      if (nextInputs.usePcc1Check && (name === 'gasketType' || name === 'boltMaterial')) {
        nextInputs = updatePcc1Values(nextInputs.gasketType, nextInputs);
      }
    } else {
      const val = parseFloat(value) || 0;
      nextInputs = { ...nextInputs, [name]: val };
      if (name === 'g0') {
        nextInputs.g1 = Math.ceil(val * 1.3 / 3 + val);
      }
    }

    onInputChange(nextInputs, name);
  };

  const toggleManualMode = () => {
    onInputChange({ ...inputs, useManualOverride: !inputs.useManualOverride }, 'useManualOverride');
  };

  const togglePcc1Check = () => {
    let nextInputs = { ...inputs, usePcc1Check: !inputs.usePcc1Check };
    if (nextInputs.usePcc1Check) {
      nextInputs = updatePcc1Values(inputs.gasketType, nextInputs);
    }
    onInputChange(nextInputs, 'usePcc1Check');
  };

  const applyGasketBounds = (id: number, od: number) => {
    const nextInputs = {
      ...inputs,
      manualSeatingID: parseFloat(id.toFixed(2)),
      manualSeatingOD: parseFloat(od.toFixed(2))
    };
    onInputChange(nextInputs, 'manualSeatingOD');
  };

  const resetGasketStandard = () => {
    const nextInputs = {
      ...inputs,
      cClearance: 2.5,
      shellGapA: 3.0,
      innerRingWidthManual: 0,
      outerRingWidthManual: 0,
      hasInnerRing: true,
      hasOuterRing: true,
      useManualOverride: false,
      manualM: 0,
      manualY: 0,
      manualPassM: 0,
      manualPassY: 0,
      manualSeatingID: 0,
      manualSeatingOD: 0,
      actualBCD: 0,
      actualOD: 0,
      useHydraulicTensioning: false,
      usePcc1Check: false,
      passPartitionWidth: 0,
      passPartitionLength: 0,
      passPartAreaReduction: 50,
      phiFMax: 0.32,
      phiGMax: 1,
      g: 0.7
    };
    onInputChange(nextInputs, 'reset');
  };

  const inputClass = "w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all outline-none text-sm";
  const disabledInputClass = "w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-400 cursor-not-allowed text-sm opacity-60";
  const selectClass = "px-2 py-2 bg-gray-50 border border-gray-300 rounded-md focus:ring-2 focus:ring-sky-500 transition-all outline-none text-xs font-bold text-gray-600";
  const labelClass = "block text-[11px] font-bold text-gray-500 mb-1 uppercase tracking-wider";

  const ringConfig = GASKET_RING_TABLE.find(r => inputs.insideDia >= r.min && inputs.insideDia <= r.max) || GASKET_RING_TABLE[GASKET_RING_TABLE.length-1];
  const autoIR = ringConfig.irMin;
  const currentIR = inputs.hasInnerRing ? (inputs.innerRingWidthManual || autoIR) : 0;

  const s1OD = results.maxRaisedFace; 
  const s2OD = inputs.insideDia + (2 * (inputs.shellGapA !== undefined ? inputs.shellGapA : 3.0)) + (2 * currentIR) + (2 * inputs.gasketSeatingWidth); 

  let isSug1Active = false;
  let isSug2Active = false;

  if (inputs.manualSeatingOD !== 0) {
    isSug1Active = Math.abs(inputs.manualSeatingOD - s1OD) < 0.1;
    isSug2Active = Math.abs(inputs.manualSeatingOD - s2OD) < 0.1;
  } else {
    if (s1OD >= s2OD) isSug1Active = true;
    else isSug2Active = true;
  }

  const filteredBolts = TEMA_BOLT_DATA.filter(b => b.size >= 0.75);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h2 className="text-lg font-bold mb-4 text-gray-800 flex items-center gap-2 border-b pb-3 uppercase tracking-tighter">
        <i className="fa-solid fa-sliders text-sky-600"></i> Input Parameters
      </h2>

      <div className="mb-6 p-0 bg-[#1a1a1a] rounded-xl border border-gray-800 overflow-hidden relative shadow-2xl">
        <div className="absolute top-2 left-0 w-full text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] text-center pointer-events-none">Engineering Legend (TEMA RCB-11.2)</div>
        <svg viewBox="0 0 550 310" className="w-full h-auto">
          <g stroke="white" strokeWidth="1.2" fill="none">
            <path d="M 100,20 L 290,20 L 290,50 M 290,110 L 290,110 L 100,110" />
            <line x1="100" y1="20" x2="100" y2="50" />
            <line x1="100" y1="50" x2="290" y2="50" />
            <path d="M 100,110 L 100,155 L 120,155 L 120,185 L 100,185 L 100,270 L 410,270 L 410,230 L 290,175 L 290,110 Z" />
          </g>
          <line x1="90" y1="80" x2="290" y2="80" stroke="#ff0000" strokeWidth="1.5" strokeDasharray="15 3 3 3" />
          <text x="180" y="80" className="fill-yellow-400 font-bold text-[14px]" textAnchor="middle" alignmentBaseline="middle">BCD</text>
          <line x1="290" y1="80" x2="480" y2="80" stroke="#ff0000" strokeWidth="1.5" strokeDasharray="15 3 3 3" />
          <g stroke="#00ff00" strokeWidth="0.8">
            <line x1="40" y1="20" x2="95" y2="20" />
            <line x1="50" y1="5" x2="50" y2="20" />
            <line x1="40" y1="80" x2="95" y2="80" />
            <line x1="40" y1="110" x2="95" y2="110" />
            <line x1="50" y1="80" x2="50" y2="110" />
            <line x1="40" y1="155" x2="95" y2="155" />
            <line x1="50" y1="110" x2="50" y2="155" />
            <line x1="40" y1="185" x2="115" y2="185" />
            <line x1="50" y1="155" x2="50" y2="185" />
            <line x1="40" y1="270" x2="95" y2="270" />
            <line x1="50" y1="240" x2="50" y2="270" />
            <line x1="95" y1="240" x2="135" y2="240" />
          </g>
          <g className="fill-yellow-400 text-[11px] font-bold italic">
            <text x="10" y="45">FLANGE OD</text>
            <text x="15" y="135">C</text>
            <text x="15" y="175">B (1.5MM)</text>
            <text x="15" y="260">A (3.0 MM)</text>
          </g>
          <rect x="105" y="185" width="12" height="15" fill="#ff0000" />
          <rect x="105" y="225" width="12" height="15" fill="#ff0000" />
          <rect x="105" y="200" width="12" height="25" fill="none" stroke="white" strokeWidth="0.8" />
          <line x1="140" y1="190" x2="160" y2="190" stroke="#00ff00" strokeWidth="0.8" />
          <line x1="140" y1="250" x2="160" y2="250" stroke="#00ff00" strokeWidth="0.8" />
          <line x1="155" y1="190" x2="155" y2="250" stroke="#00ff00" strokeWidth="0.8" />
          <g className="fill-yellow-400 text-[8px] font-bold text-center">
            <text x="165" y="210">GASKET WITH</text>
            <text x="165" y="222">INNER &</text>
            <text x="165" y="234">OUTER RING</text>
          </g>
          <g stroke="#00ff00" strokeWidth="0.8">
            <line x1="300" y1="20" x2="470" y2="20" />
            <line x1="470" y1="5" x2="470" y2="20" />
            <line x1="470" y1="20" x2="470" y2="80" />
            <line x1="470" y1="20" x2="470" y2="175" />
            <line x1="300" y1="175" x2="470" y2="175" />
            <line x1="470" y1="175" x2="470" y2="230" />
            <line x1="415" y1="230" x2="470" y2="230" />
            <line x1="470" y1="230" x2="470" y2="270" />
            <line x1="415" y1="270" x2="470" y2="270" />
          </g>
          <g className="fill-yellow-400 text-[12px] font-bold italic">
            <text x="400" y="60" textAnchor="middle">E (EDGE DISTANCE)</text>
            <text x="400" y="135" textAnchor="middle">R (RADIAL DISTANCE)</text>
            <text x="460" y="210" className="text-[14px]">g1</text>
            <text x="460" y="255" className="text-[14px]">g0</text>
          </g>
          <line x1="255" y1="275" x2="255" y2="285" stroke="#00ff00" strokeWidth="0.8" />
          <text x="255" y="300" className="fill-yellow-400 font-bold text-[12px] italic uppercase" textAnchor="middle">FLANGE ID</text>
        </svg>
      </div>
      
      <div className="space-y-6">
        <section className="space-y-3 bg-red-50 p-4 rounded-lg border border-red-100 shadow-sm">
          <h3 className="text-xs font-black text-red-600 border-l-4 border-red-500 pl-2 mb-3 uppercase tracking-tighter">Design Conditions (Shell)</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>ITEM NO</label>
              <input type="text" name="itemNo" value={inputs.itemNo || ''} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>PART</label>
              <input type="text" name="partName" value={inputs.partName || ''} onChange={handleChange} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Temp</label>
              <div className="flex gap-1">
                <input type="number" name="designTemp" value={inputs.designTemp} onChange={handleChange} className={inputClass} />
                <select name="tempUnit" value={inputs.tempUnit} onChange={handleChange} className={selectClass}>
                  <option value="°C">°C</option>
                  <option value="°F">°F</option>
                  <option value="K">K</option>
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>Pressure</label>
              <div className="flex gap-1">
                <input type="number" name="designPressure" value={inputs.designPressure} onChange={handleChange} className={inputClass} />
                <select name="pressureUnit" value={inputs.pressureUnit} onChange={handleChange} className={selectClass}>
                  <option value="MPa">MPa</option>
                  <option value="Bar">Bar</option>
                  <option value="PSI">PSI</option>
                  <option value="kg/cm²">kg/cm²</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pt-2 grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Joint Efficiency (E)</label>
              <select name="jointEfficiency" value={inputs.jointEfficiency} onChange={handleChange} className={inputClass}>
                <option value="1">1.0</option>
                <option value="0.85">0.85</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Corrosion (mm)</label>
              <input type="number" name="corrosionAllowance" value={inputs.corrosionAllowance} onChange={handleChange} className={inputClass} />
            </div>
          </div>

          <div className="pt-2">
            <label className={labelClass}>Shell Material</label>
            <select name="shellMaterial" value={inputs.shellMaterial} onChange={handleChange} className={`${inputClass} border-sky-200 bg-sky-50/20`}>
              {ASME_PLATE_MATERIALS.map(mat => (
                <option key={mat.id} value={mat.id}>{mat.id}</option>
              ))}
            </select>
          </div>

          <div className="pt-2">
            <label className={labelClass}>Bolt Material</label>
            <select name="boltMaterial" value={inputs.boltMaterial} onChange={handleChange} className={inputClass}>
              {ASME_BOLT_MATERIALS.map(mat => (
                <option key={mat.id} value={mat.id}>{mat.id}</option>
              ))}
            </select>
          </div>
          
          <div className="pt-2">
            <label className={labelClass}>Facing Sketch (Div.2 Tab. 14.16.3)</label>
            <select name="facingSketch" value={inputs.facingSketch} onChange={handleChange} className={`${inputClass} font-bold text-sky-700`}>
              {[
                "1a: Flat Face / Groove",
                "1b: Flat Face",
                "1c: Tongue & Groove",
                "1d: Flat Face w/ Nubbin",
                "2: Ring Joint"
              ].map(sk => (
                <option key={sk} value={sk}>{sk}</option>
              ))}
            </select>
          </div>
          <div className="pt-2">
            <label className={labelClass}>Gasket Type (Flange)</label>
            <select name="gasketType" value={inputs.gasketType} onChange={handleChange} className={inputClass}>
              {GASKET_TYPES.map(g => (
                <option key={g.id} value={g.id}>{g.id}</option>
              ))}
            </select>
          </div>
          <div className="pt-2">
            <label className={labelClass}>Gasket Type (Pass part)</label>
            <select name="passGasketType" value={inputs.passGasketType} onChange={handleChange} className={`${inputClass} border-amber-200 bg-amber-50/20`}>
              {GASKET_TYPES.map(g => (
                <option key={g.id} value={g.id}>{g.id}</option>
              ))}
            </select>
          </div>
        </section>

        <section className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-100">
          <h3 className="text-xs font-black text-slate-500 border-l-4 border-slate-400 pl-2 mb-3 uppercase tracking-tighter flex justify-between items-center">
            <span>Shell & Hub Geometry</span>
            <div className="flex items-center gap-1">
              <button 
                onClick={onOptimize}
                className="text-[9px] bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-full font-black flex items-center gap-1 transition-all active:scale-95 shadow-sm"
              >
                <i className="fa-solid fa-play text-[7px]"></i> START
              </button>
              <button 
                onClick={onResetOptimize}
                title="Reset Override & Auto Optimize All"
                className="text-[9px] bg-slate-600 hover:bg-slate-700 text-white px-3 py-1 rounded-full font-black flex items-center gap-1 transition-all active:scale-95 shadow-sm"
              >
                <i className="fa-solid fa-rotate-left text-[7px]"></i> RESET
              </button>
            </div>
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Shell I.D (mm)</label>
              <input type="number" name="insideDia" value={inputs.insideDia} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Bolt Count (EA)</label>
              <input type="number" name="boltCount" value={inputs.boltCount} onChange={handleChange} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>g0 (mm)</label>
              <input type="number" name="g0" value={inputs.g0} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass} title="Auto-calculated: roundup(g0 * 1.3 / 3 + g0)">g1 (mm) <i className="fa-solid fa-calculator ml-1 text-sky-500 text-[8px]"></i></label>
              <input 
                type="number" 
                name="g1" 
                value={inputs.g1.toFixed(0)} 
                readOnly 
                className={`${inputClass} bg-slate-100 border-dashed cursor-not-allowed font-bold text-sky-700`} 
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button 
              onClick={resetGasketStandard}
              title="Reset Parameters to Standard Values"
              className="text-[9px] bg-sky-600 hover:bg-sky-700 text-white px-4 py-1.5 rounded-full font-black flex items-center gap-2 transition-all active:scale-95 shadow-md"
            >
              <i className="fa-solid fa-rotate-left"></i> GASKET RESET
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Shell Gap A (mm)</label>
              <input 
                type="number" 
                name="shellGapA" 
                value={inputs.shellGapA} 
                onChange={handleChange} 
                placeholder="Std: 3.0mm"
                className={inputClass} 
              />
            </div>
            <div>
              <label className={labelClass}>Clearance C (mm)</label>
              <input 
                type="number" 
                name="cClearance" 
                value={inputs.cClearance} 
                onChange={handleChange} 
                placeholder="Std: 2.5mm"
                className={inputClass} 
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className={labelClass}>Contact Width N (mm)</label>
              <input 
                type="number" 
                name="gasketSeatingWidth" 
                value={inputs.gasketSeatingWidth} 
                onChange={handleChange} 
                className={inputClass} 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Pass Part W (mm)</label>
              <input 
                type="number" 
                name="passPartitionWidth" 
                value={inputs.passPartitionWidth} 
                onChange={handleChange} 
                className={inputClass} 
              />
            </div>
            <div>
              <label className={labelClass}>Pass Part L(mm)</label>
              <input type="number" name="passPartitionLength" value={inputs.passPartitionLength} onChange={handleChange} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input type="checkbox" name="hasInnerRing" checked={inputs.hasInnerRing} onChange={handleChange} className="w-4 h-4 text-sky-600" />
                <label className={labelClass}>Inner Ring</label>
              </div>
              <input 
                type="number" 
                name="innerRingWidthManual" 
                value={inputs.innerRingWidthManual || results.innerRingWidth} 
                onChange={handleChange} 
                disabled={!inputs.hasInnerRing}
                placeholder={`Table: ${ringConfig.irMin}mm`}
                className={`${!inputs.hasInnerRing ? disabledInputClass : 'bg-blue-50/30 ' + inputClass}`} 
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input type="checkbox" name="hasOuterRing" checked={inputs.hasOuterRing} onChange={handleChange} className="w-4 h-4 text-sky-600" />
                <label className={labelClass}>Outer Ring</label>
              </div>
              <input 
                type="number" 
                name="outerRingWidthManual" 
                value={inputs.outerRingWidthManual || results.outerRingWidth} 
                onChange={handleChange} 
                disabled={!inputs.hasOuterRing}
                placeholder={`Table: ${ringConfig.orMin}mm`}
                className={`${!inputs.hasOuterRing ? disabledInputClass : 'bg-blue-50/30 ' + inputClass}`} 
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Bolt Size (inch)</label>
            <select name="boltSize" value={inputs.boltSize} onChange={handleChange} className={inputClass}>
              {filteredBolts.map(bolt => (
                <option key={bolt.size} value={bolt.size}>{bolt.size}"</option>
              ))}
            </select>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                const nextInputs = { ...inputs, useHydraulicTensioning: !inputs.useHydraulicTensioning };
                onInputChange(nextInputs, 'useHydraulicTensioning');
              }}
              className={`w-full py-2.5 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border-2 ${
                inputs.useHydraulicTensioning
                  ? 'bg-sky-600 border-sky-600 text-white shadow-lg shadow-sky-200'
                  : 'bg-white border-slate-200 text-slate-400 hover:border-sky-300 hover:text-sky-500'
              }`}
            >
              <i className="fa-solid fa-oil-can"></i>
              Hydraulic Bolt Tensioning
              {inputs.useHydraulicTensioning && <i className="fa-solid fa-circle-check ml-auto text-xs"></i>}
            </button>
          </div>
        </section>

        <section className="space-y-3 bg-sky-50/50 p-4 rounded-lg border border-sky-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-sky-200/20 rounded-bl-full pointer-events-none"></div>
          
          <h3 className="text-xs font-black text-sky-600 border-l-4 border-sky-500 pl-2 mb-3 uppercase tracking-tighter">
            <span>Gasket / Clearance Logic</span>
          </h3>

          <div className="grid grid-cols-1 gap-3 mb-2">
            <button 
              onClick={() => applyGasketBounds(results.maxRaisedFace - (inputs.gasketSeatingWidth * 2), results.maxRaisedFace)}
              className={`group p-2.5 border rounded-lg text-left transition-all shadow-md active:scale-[0.98] ${
                isSug1Active 
                  ? 'bg-indigo-800 border-indigo-900 text-white ring-4 ring-indigo-200' 
                  : 'bg-white border-indigo-100 hover:bg-indigo-50 hover:border-indigo-400'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <i className={`fa-solid fa-circle-dot text-[10px] ${isSug1Active ? 'text-indigo-200 animate-pulse' : 'text-indigo-400 group-hover:text-indigo-600'}`}></i>
                <span className={`block text-[7px] font-black uppercase tracking-wider transition-colors ${
                  isSug1Active ? 'text-indigo-100' : 'text-indigo-400 group-hover:text-indigo-600'
                }`}>GASKET SEATING OD (BASED ON BCD)</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className={`text-sm font-black ${isSug1Active ? 'text-white' : 'text-slate-700'}`}>{s1OD.toFixed(1)}</span>
                <span className={`text-[8px] font-bold uppercase ${isSug1Active ? 'text-indigo-200' : 'text-slate-400'}`}>mm</span>
              </div>
              <div className={`text-[7px] mt-1 font-bold ${isSug1Active ? 'text-indigo-200' : 'text-slate-400'}`}>
                Logic: BCD - Hole - 2C - 2B - 2OR
              </div>
              {isSug1Active && (
                <div className="mt-2 text-[6px] font-black text-indigo-300 uppercase tracking-tighter flex items-center gap-1">
                  <i className="fa-solid fa-check-double"></i> Currently Applied Logic
                </div>
              )}
            </button>

            <button 
              onClick={() => {
                 const currentS2OD = inputs.insideDia + (2 * (inputs.shellGapA !== undefined ? inputs.shellGapA : 3.0)) + (2 * currentIR) + (2 * inputs.gasketSeatingWidth);
                 applyGasketBounds(currentS2OD - (inputs.gasketSeatingWidth * 2), currentS2OD);
              }}
              className={`group p-2.5 border rounded-lg text-left transition-all shadow-md active:scale-[0.98] ${
                isSug2Active 
                  ? 'bg-sky-800 border-sky-900 text-white ring-4 ring-sky-200' 
                  : 'bg-white border-sky-100 hover:bg-sky-50 hover:border-sky-400'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <i className="fa-solid fa-circle-info text-[10px] ${isSug2Active ? 'text-sky-200 animate-pulse' : 'text-sky-400 group-hover:text-sky-600'}"></i>
                <span className={`block text-[7px] font-black uppercase tracking-wider transition-colors ${
                  isSug2Active ? 'text-sky-100' : 'text-sky-400 group-hover:text-sky-600'
                }`}>GASKET SEATING OD (BASED ON SHELL ID)</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className={`text-sm font-black ${isSug2Active ? 'text-white' : 'text-slate-700'}`}>{s2OD.toFixed(1)}</span>
                <span className={`text-[8px] font-bold uppercase ${isSug2Active ? 'text-indigo-200' : 'text-slate-400'}`}>mm</span>
              </div>
              <div className={`text-[7px] mt-1 font-bold ${isSug2Active ? 'text-sky-200' : 'text-slate-400'}`}>
                Logic: Shell ID + 2A + 2IR + 2N
              </div>
              {isSug2Active && (
                <div className="mt-2 text-[6px] font-black text-sky-300 uppercase tracking-tighter flex items-center gap-1">
                  <i className="fa-solid fa-check-double"></i> Currently Applied Logic
                </div>
              )}
            </button>
          </div>
        </section>

        <section className="pt-4 border-t border-dashed space-y-4">
          <div>
            <button 
              type="button"
              onClick={toggleManualMode}
              className={`w-full py-2.5 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border-2 ${
                inputs.useManualOverride 
                ? 'bg-amber-600 border-amber-600 text-white shadow-lg shadow-amber-200' 
                : 'bg-white border-slate-200 text-slate-400 hover:border-amber-400 hover:text-amber-600'
              }`}
            >
              <i className={`fa-solid ${inputs.useManualOverride ? 'fa-lock-open' : 'fa-lock'}`}></i>
              MANUAL INPUT
              {inputs.useManualOverride && <i className="fa-solid fa-circle-check ml-auto text-xs"></i>}
            </button>
          </div>

          {inputs.useManualOverride && (
            <div className="space-y-4 bg-amber-50/30 p-4 rounded-xl border border-amber-100 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>BCD (mm)</label>
                  <input 
                    type="number" 
                    name="actualBCD" 
                    value={inputs.actualBCD} 
                    placeholder={results.finalBCD.toFixed(1)}
                    onChange={handleChange} 
                    className={inputClass} 
                  />
                </div>
                <div>
                  <label className={labelClass}>Flange OD (mm)</label>
                  <input 
                    type="number" 
                    name="actualOD" 
                    value={inputs.actualOD} 
                    placeholder={results.finalOD.toFixed(0)}
                    onChange={handleChange} 
                    className={inputClass} 
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Gasket M</label>
                  <input 
                    type="number" 
                    name="manualM" 
                    value={inputs.manualM} 
                    placeholder={results.gasketM.toFixed(2)}
                    onChange={handleChange} 
                    className={inputClass} 
                  />
                </div>
                <div>
                  <label className={labelClass}>Gasket Y (PSI)</label>
                  <input 
                    type="number" 
                    name="manualY" 
                    value={inputs.manualY} 
                    placeholder={results.gasketY.toString()}
                    onChange={handleChange} 
                    className={inputClass} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Gasket M(Pass)</label>
                  <input 
                    type="number" 
                    name="manualPassM" 
                    value={inputs.manualPassM} 
                    placeholder={results.passM.toFixed(2)}
                    onChange={handleChange} 
                    className={`${inputClass} border-indigo-200 bg-indigo-50/10`} 
                  />
                </div>
                <div>
                  <label className={labelClass}>Gasket Y(pass) (PSI)</label>
                  <input 
                    type="number" 
                    name="manualPassY" 
                    value={inputs.manualPassY} 
                    placeholder={results.passY.toString()}
                    onChange={handleChange} 
                    className={`${inputClass} border-indigo-200 bg-indigo-50/10`} 
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className={labelClass}>Seating ID/OD</label>
                <div className="grid grid-cols-2 gap-2">
                   <input 
                    type="number" 
                    name="manualSeatingID" 
                    value={inputs.manualSeatingID} 
                    onChange={handleChange} 
                    className={inputClass} 
                   />
                   <input 
                    type="number" 
                    name="manualSeatingOD" 
                    value={inputs.manualSeatingOD} 
                    onChange={handleChange} 
                    className={inputClass} 
                   />
                </div>
              </div>
            </div>
          )}

          <div>
            <button 
              type="button"
              onClick={togglePcc1Check}
              className={`w-full py-2.5 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border-2 ${
                inputs.usePcc1Check 
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200' 
                : 'bg-white border-slate-200 text-slate-400 hover:border-emerald-400 hover:text-emerald-600'
              }`}
            >
              <i className="fa-solid fa-list-check"></i>
              PCC-1 CHECK
              {inputs.usePcc1Check && <i className="fa-solid fa-circle-check ml-auto text-xs"></i>}
            </button>
          </div>

          {inputs.usePcc1Check && (
            <div className="space-y-4 bg-emerald-50/30 p-4 rounded-xl border border-emerald-100 animate-in fade-in slide-in-from-top-2 duration-300">
               <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>SgT (MPa)</label>
                    <input type="number" name="sgT" value={inputs.sgT} onChange={handleChange} placeholder="SgT" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Sgmin-S (MPa)</label>
                    <input type="number" name="sgMinS" value={inputs.sgMinS} onChange={handleChange} placeholder="Sgmin-S" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Sgmin-O (MPa)</label>
                    <input type="number" name="sgMinO" value={inputs.sgMinO} onChange={handleChange} placeholder="Sgmin-O" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Sgmax (MPa)</label>
                    <input type="number" name="sgMax" value={inputs.sgMax} onChange={handleChange} placeholder="Sgmax" className={inputClass} />
                  </div>
                  <div className="relative">
                    <label className={labelClass}>Sbmax (MPa) <span className="text-[8px] text-sky-600 normal-case">(70% Yield)</span></label>
                    <input type="number" name="sbMax" value={inputs.sbMax} onChange={handleChange} placeholder="Sbmax" className={inputClass} step="0.1" />
                  </div>
                  <div className="relative">
                    <label className={labelClass}>Sbmin (MPa) <span className="text-[8px] text-sky-600 normal-case">(40% Yield)</span></label>
                    <input type="number" name="sbMin" value={inputs.sbMin} onChange={handleChange} placeholder="Sbmin" className={inputClass} step="0.1" />
                  </div>
                  <div>
                    <label className={labelClass}>Sfmax (MPa)</label>
                    <input type="number" name="sfMax" value={inputs.sfMax} onChange={handleChange} placeholder="Sfmax" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Φfmax (deg)</label>
                    <input type="number" name="phiFMax" value={inputs.phiFMax} onChange={handleChange} placeholder="Φfmax" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>fraction of gasket</label>
                    <input type="number" name="g" value={inputs.g} onChange={handleChange} placeholder="g" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Pass part reduction (%)</label>
                    <input type="number" name="passPartAreaReduction" value={inputs.passPartAreaReduction} onChange={handleChange} placeholder="%" className={inputClass} />
                  </div>
               </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
