import React, { useState, useEffect } from 'react';
import { CalculationResults, FlangeInputs } from '../types';
import { TEMA_BOLT_DATA, ASME_BOLT_MATERIALS, BOLT_TEMP_STEPS, GASKET_TYPES, GASKET_RING_TABLE, HYDRAULIC_TENSIONING_DATA, API660_PCC1_STRESS_TABLE, ASME_PLATE_MATERIALS } from '../constants';

interface Props {
  inputs: FlangeInputs;
  results: CalculationResults;
}

type ForceUnit = 'kN' | 'N' | 'lbf' | 'kgf';
type TabId = 'current' | 'bolts' | 'tensioning' | 'stress' | 'plate_stress' | 'gaskets' | 'rings' | 'pcc1';

export const BoltLoadTable: React.FC<Props> = ({ inputs, results }) => {
  const [showBackData, setShowBackData] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('current');
  
  const getDefaultForceUnit = (pressureUnit: string): ForceUnit => {
    switch (pressureUnit) {
      case 'PSI': return 'lbf';
      case 'kg/cm²': return 'kgf';
      case 'MPa':
      case 'Bar':
      default: return 'kN';
    }
  };

  const [selectedForceUnit, setSelectedForceUnit] = useState<ForceUnit>(getDefaultForceUnit(inputs.pressureUnit));

  useEffect(() => {
    setSelectedForceUnit(getDefaultForceUnit(inputs.pressureUnit));
  }, [inputs.pressureUnit]);

  const convertForce = (valueInN: number, unit: ForceUnit): number => {
    switch (unit) {
      case 'kN': return valueInN / 1000;
      case 'lbf': return valueInN * 0.224809;
      case 'kgf': return valueInN * 0.101972;
      case 'N':
      default: return valueInN;
    }
  };

  const formatValue = (val: number) => {
    if (selectedForceUnit === 'N') return val.toLocaleString(undefined, { maximumFractionDigits: 0 });
    return val.toLocaleString(undefined, { maximumFractionDigits: 1 });
  };

  // 1. Ag: Gasket Area Calculation
  const ringArea = (Math.PI / 4) * (Math.pow(results.seatingOD, 2) - Math.pow(results.seatingID, 2));
  const reducedPassArea = (inputs.passPartAreaReduction / 100) * inputs.passPartitionWidth * inputs.passPartitionLength;
  const totalAg = ringArea + reducedPassArea;

  // 2. Sbsel: Raw calculated bolt stress
  const totalBoltRootArea = results.singleBoltArea * inputs.boltCount;
  const sbSelCalc = totalBoltRootArea > 0 ? (inputs.sgT * totalAg) / totalBoltRootArea : 0;

  // 3. Select Sbsel Logic 
  const valA = Math.min(sbSelCalc, inputs.sbMax || Infinity);
  const valB = Math.max(valA, inputs.sbMin || 0);
  const valC = Math.min(valB, inputs.sfMax || Infinity);
  const sbSelFinal = Math.min(valA, valB, valC);

  // Pressure unit conversion for Step 6 & Formulas
  const pMpa = (() => {
    const p = inputs.designPressure;
    switch (inputs.pressureUnit) {
      case 'Bar': return p * 0.1;
      case 'PSI': return p * 0.00689476;
      case 'kg/cm²': return p * 0.0980665;
      default: return p;
    }
  })();

  const yMpa = results.gasketY * 0.00689476;
  const passYMpa = results.passY * 0.00689476;

  // Step 5: Sbsel >= Sgmin-S * [Ag / (Ab * nb)]
  const step5Threshold = totalBoltRootArea > 0 ? inputs.sgMinS * (totalAg / totalBoltRootArea) : 0;
  const isStep5Ok = sbSelFinal >= step5Threshold - 0.001;

  // Step 6: Sbsel ≥ (Sgmin-O Ag + pi()/4Pmax GI.D^2)/(g Abnb)
  const step6Numerator = (inputs.sgMinO * totalAg) + ((Math.PI / 4) * pMpa * Math.pow(results.seatingID, 2));
  const step6Denominator = (inputs.g || 1) * totalBoltRootArea;
  const step6Threshold = totalBoltRootArea > 0 ? step6Numerator / step6Denominator : 0;
  const isStep6Ok = sbSelFinal >= step6Threshold - 0.001;

  // Step 7. Sbsel ≤ Sgmax [Ag/(Abnb)]
  const step7Threshold = totalBoltRootArea > 0 ? inputs.sgMax * (totalAg / totalBoltRootArea) : Infinity;
  const isStep7Ok = inputs.sgMax === 0 ? true : (sbSelFinal <= step7Threshold + 0.001);

  // Step 8. Sbsel ≤ Sfmax (g / Φfmax)
  const step8Threshold = inputs.phiFMax > 0 ? inputs.sfMax * ((inputs.g || 1) / inputs.phiFMax) : Infinity;
  const isStep8Ok = inputs.phiFMax === 0 ? true : (sbSelFinal <= step8Threshold + 0.001);

  const currentBoltRef = TEMA_BOLT_DATA.find(b => b.size === inputs.boltSize);

  const tableHeaderClass = "px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-200 sticky top-0 z-10 whitespace-nowrap";
  const tableCellClass = "px-4 py-3 text-[10px] font-mono text-slate-700 border-b border-slate-100 whitespace-nowrap";

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden text-slate-900">
        <div className="bg-slate-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-200">
              <i className="fa-solid fa-calculator text-white text-sm"></i>
            </div>
            Bolt Load Calculation (ASME DIV.2 4.16.6)
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex gap-1">
              <span className="text-[10px] bg-sky-100 px-2 py-1 rounded text-sky-700 font-black border border-sky-200 uppercase tracking-tight">m = {results.gasketM}</span>
              <span className="text-[10px] bg-amber-100 px-2 py-1 rounded text-amber-700 font-black border border-amber-200 uppercase tracking-tight">y = {results.gasketY} psi</span>
            </div>
            <select 
              value={selectedForceUnit} 
              onChange={(e) => setSelectedForceUnit(e.target.value as ForceUnit)}
              className="text-[11px] font-black bg-white border border-gray-300 rounded-md px-3 py-1 text-slate-700 focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all"
            >
              {['kN', 'N', 'lbf', 'kgf'].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-4 space-y-4">
              <div className="h-full bg-indigo-50/50 rounded-xl border border-indigo-100 p-5">
                <h3 className="text-[11px] font-black text-indigo-700 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <i className="fa-solid fa-shapes"></i> G & b Calculation
                </h3>
                
                <div className="grid grid-cols-1 gap-4">
                  <div className="p-4 bg-white rounded-xl border border-indigo-100 shadow-sm">
                    <div className="text-[9px] font-black text-indigo-400 uppercase mb-2">1. Gasket Mean Dia (G)</div>
                    <div className="text-[10px] font-mono text-slate-600 leading-relaxed">
                      {results.b0Width <= 6 ? (
                        <div className="mb-2">
                          <div className="opacity-50 text-[8px] mb-1 font-sans">b₀ ≤ 6: (ID + OD) / 2</div>
                          <div className="flex justify-between font-bold">
                            <span>({results.seatingID.toFixed(1)} + {results.seatingOD.toFixed(1)}) / 2</span>
                          </div>
                        </div>
                      ) : (
                        <div className="mb-2">
                          <div className="opacity-50 text-[8px] mb-1 font-sans">b₀ > 6: Gasket OD - 2b</div>
                          <div className="flex justify-between font-bold">
                            <span>{results.seatingOD.toFixed(1)} - (2 × {results.bWidth.toFixed(2)})</span>
                          </div>
                        </div>
                      )}
                      <div className="pt-2 border-t border-indigo-50 text-indigo-800 font-black text-[10px] flex justify-between items-baseline">
                        <span className="font-sans opacity-50 uppercase tracking-tighter">Final G</span>
                        <span className="font-mono">{results.gMeanDia.toFixed(1)} <small className="text-[9px]">mm</small></span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-white rounded-xl border border-indigo-100 shadow-sm">
                    <div className="text-[9px] font-black text-indigo-400 uppercase mb-2">2. Basic Width (b₀)</div>
                    <div className="text-[10px] font-mono text-slate-600">
                      <div className="flex justify-between items-center mb-1">
                        <span className="opacity-50 font-sans text-[8px] uppercase">Contact N</span>
                        <span className="font-bold">{results.nWidth.toFixed(2)} mm</span>
                      </div>
                      <div className="pt-2 border-t border-indigo-50 text-slate-900 font-black text-[10px] flex justify-between items-baseline">
                         <span className="font-sans opacity-50 uppercase tracking-tighter">Final b₀</span>
                         <span className="font-mono">{results.b0Width.toFixed(2)} <small className="text-[9px]">mm</small></span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-white rounded-xl border border-indigo-100 shadow-sm">
                    <div className="text-[9px] font-black text-indigo-400 uppercase mb-2">3. Effective Width (b)</div>
                    <div className="text-[10px] opacity-70 italic mb-2 font-sans text-slate-500">
                      {results.b0Width > 6 ? "0.5 Cul √ (b₀ / Cul)" : "b = b₀"}
                    </div>
                    <div className="pt-2 border-t border-indigo-50 text-indigo-600 font-black text-[10px] flex justify-between items-baseline font-mono">
                      <span className="font-sans opacity-50 uppercase text-slate-900 tracking-tighter">Final b</span>
                      <span>{results.bWidth.toFixed(2)} <small className="text-[9px]">mm</small></span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="lg:col-span-8 space-y-4">
              <div className="h-full bg-sky-50/50 rounded-xl border border-sky-100 p-5">
                <h3 className="text-[11px] font-black text-sky-700 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <i className="fa-solid fa-weight-hanging"></i> Bolt Load Breakdown
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-5 rounded-xl border border-sky-100 shadow-sm space-y-4">
                    <div className="text-[11px] font-black text-sky-800 border-b border-sky-50 pb-2 flex justify-between uppercase">
                      <span>Operating (W<sub>o</sub>)</span>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Hydrostatic Force (H)</div>
                        <div className="text-[9px] font-mono text-slate-600 mb-2 leading-tight">
                          0.785 × G² × P <br/>
                          = 0.785 × {results.gMeanDia.toFixed(1)}² × {pMpa.toFixed(3)} MPa
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                          <span className="text-[8px] font-bold text-slate-400">RESULT</span>
                          <span className="font-black text-[11px] text-sky-600">{formatValue(convertForce(results.hForce, selectedForceUnit))} <small className="text-[9px] uppercase">{selectedForceUnit}</small></span>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Gasket Load (H<sub>p</sub>)</div>
                        <div className="text-[9px] font-mono text-slate-600 mb-1 leading-tight">
                          [2·b·π·G·m·P] + [2·P·(w_p·L_p·m_p)] <br/>
                          = [2 × {results.bWidth.toFixed(2)} × π × {results.gMeanDia.toFixed(1)} × {results.gasketM} × {pMpa.toFixed(3)}]
                          {inputs.passPartitionWidth > 0 && (
                            <span className="block mt-1">
                              + [2 × {pMpa.toFixed(3)} × ({inputs.passPartitionWidth} × {inputs.passPartitionLength} × {results.passM})]
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                          <span className="text-[8px] font-bold text-slate-400">RESULT</span>
                          <span className="font-black text-[11px] text-sky-600">{formatValue(convertForce(results.hpForce, selectedForceUnit))} <small className="text-[9px] uppercase">{selectedForceUnit}</small></span>
                        </div>
                      </div>

                      <div className="pt-2 flex justify-between items-center">
                        <span className="text-[10px] font-black text-sky-800">Total W<sub>o</sub></span>
                        <span className="text-xl font-black text-sky-600">{formatValue(convertForce(results.wm1, selectedForceUnit))}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-amber-100 shadow-sm space-y-4 flex flex-col">
                    <div className="text-[11px] font-black text-amber-800 border-b border-amber-50 pb-2 uppercase">
                      Seating (W<sub>g</sub>)
                    </div>
                    
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex-1">
                      <div className="text-[9px] text-slate-400 font-bold uppercase mb-1">Seating Gasket Load</div>
                      <div className="text-[9px] font-mono text-slate-600 mb-2 leading-tight">
                        [π·b·G·y] + [w_p·L_p·y_p] <br/>
                        = [π × {results.bWidth.toFixed(2)} × {results.gMeanDia.toFixed(1)} × {yMpa.toFixed(3)} MPa]
                        {inputs.passPartitionWidth > 0 && (
                          <span className="block mt-1">
                            + [{inputs.passPartitionWidth} × {inputs.passPartitionLength} × {passYMpa.toFixed(3)} MPa]
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                        <span className="text-[8px] font-bold text-slate-400">RESULT</span>
                        <span className="font-black text-[11px] text-amber-600">{formatValue(convertForce(results.wm2, selectedForceUnit))} <small className="text-[9px] uppercase">{selectedForceUnit}</small></span>
                      </div>
                    </div>

                    <div className="pt-6 flex justify-between items-center">
                      <span className="text-[10px] font-black text-amber-800">Total W<sub>g</sub></span>
                      <span className="text-xl font-black text-amber-600">{formatValue(convertForce(results.wm2, selectedForceUnit))}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {inputs.usePcc1Check && (
        <div className="bg-white rounded-2xl shadow-xl border border-emerald-200 overflow-hidden text-slate-900 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="bg-emerald-50 px-6 py-3 border-b border-emerald-200 flex justify-between items-center">
            <h2 className="text-sm font-black text-emerald-800 flex items-center gap-3 uppercase tracking-tighter">
              <div className="w-6 h-6 bg-emerald-600 rounded flex items-center justify-center shadow-lg shadow-emerald-200">
                <i className="fa-solid fa-file-shield text-white text-[10px]"></i>
              </div>
              PCC-1 Calculation
            </h2>
          </div>

          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm space-y-2 group hover:border-emerald-200 transition-all">
                <div className="flex justify-between items-start">
                  <div className="text-[8.5px] font-black text-indigo-400 uppercase tracking-tighter">Ag: gasket area</div>
                  <i className="fa-solid fa-layer-group text-slate-200 group-hover:text-emerald-500 transition-colors text-[10px]"></i>
                </div>
                <div className="font-mono text-[9px] text-slate-600 leading-tight">
                  [π/4 × ({results.seatingOD.toFixed(1)}² - {results.seatingID.toFixed(1)}²)] + [({inputs.passPartAreaReduction}% / 100) × {inputs.passPartitionWidth} × {inputs.passPartitionLength}]
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-indigo-50">
                  <span className="text-[8px] font-bold text-slate-400 uppercase">Resulting Area</span>
                  <span className="text-[11px] font-black text-indigo-700">
                    {totalAg.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    <small className="text-[9px] ml-0.5 font-bold">mm²</small>
                  </span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm space-y-2 group hover:border-indigo-200 transition-all">
                <div className="flex justify-between items-start">
                  <div className="text-[8.5px] font-black text-indigo-400 uppercase tracking-tighter">Step 1: Calculated Sbsel</div>
                  <i className="fa-solid fa-bolt text-slate-200 group-hover:text-indigo-500 transition-colors text-[10px]"></i>
                </div>
                <div className="font-mono text-[9px] text-slate-600 leading-tight">
                  ({inputs.sgT} × {totalAg.toLocaleString(undefined, { maximumFractionDigits: 0 })}) / ({results.singleBoltArea.toFixed(1)} × {inputs.boltCount})
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-indigo-50">
                  <span className="text-[8px] font-bold text-slate-400 uppercase">Calc Value</span>
                  <span className="text-[11px] font-black text-indigo-700">
                    {sbSelCalc.toFixed(1)}
                    <small className="text-[9px] ml-0.5 font-bold">MPa</small>
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-indigo-50/30 rounded-xl border border-indigo-100 p-4 space-y-4">
              <h3 className="text-[11px] font-black text-indigo-700 uppercase tracking-[0.15em] border-b border-indigo-100 pb-2">Selection Sbsel</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm space-y-2">
                  <div className="text-[8.5px] font-black text-indigo-400 uppercase tracking-tighter">Step 2: Sbsel = min[Step 2 Result , Sbmax]</div>
                  <div className="font-mono text-[10px] text-slate-600">
                    min[{sbSelCalc.toFixed(1)}, {inputs.sbMax}]
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-indigo-50">
                    <span className="text-[8px] font-bold text-slate-400 uppercase">Step 2 Result</span>
                    <span className="text-[11px] font-black text-indigo-700">{valA.toFixed(1)} MPa</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm space-y-2">
                  <div className="text-[8.5px] font-black text-indigo-400 uppercase tracking-tighter">Step 3. Sbsel = max[Step 3 Result , Sbmin]</div>
                  <div className="font-mono text-[10px] text-slate-600">
                    max[{valA.toFixed(1)}, {inputs.sbMin}]
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-indigo-50">
                    <span className="text-[8px] font-bold text-slate-400 uppercase">Step 3 Result</span>
                    <span className="text-[11px] font-black text-indigo-700">{valB.toFixed(1)} MPa</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm space-y-2">
                  <div className="text-[8.5px] font-black text-indigo-400 uppercase tracking-tighter">Step 4. Sbsel = min[Step 3 Result , Sfmax]</div>
                  <div className="font-mono text-[10px] text-slate-600">
                    min[{valB.toFixed(1)}, {inputs.sfMax}]
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-indigo-50">
                    <span className="text-[8px] font-bold text-slate-400 uppercase">Step 4 Result</span>
                    <span className="text-[11px] font-black text-indigo-700">{valC.toFixed(1)} MPa</span>
                  </div>
                </div>

                <div className="bg-indigo-700/5 p-3 rounded-lg border border-indigo-700/20 shadow-sm space-y-2 ring-2 ring-indigo-700/5 flex flex-col justify-between">
                  <div className="text-[8.5px] font-black text-indigo-700 uppercase tracking-tighter">Sbsel: Final Result</div>
                  <div className="flex justify-end items-center pt-1 border-t border-indigo-700/20">
                    <span className="text-[14px] font-black text-indigo-900 tabular-nums">
                      {sbSelFinal.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      <small className="text-[9px] ml-0.5">MPa</small>
                    </span>
                  </div>
                </div>

                <div className={`p-3 rounded-lg border shadow-sm space-y-2 flex flex-col justify-between transition-colors ${isStep5Ok ? 'bg-white border-indigo-100' : 'bg-red-50 border-red-200'}`}>
                  <div className={`text-[8.5px] font-black uppercase tracking-tighter ${isStep5Ok ? 'text-indigo-400' : 'text-red-700'}`}>Step 5. Sbsel ≥ Sgmin-S [Ag/(Abnb)]</div>
                  <div className="font-mono text-[9px] text-slate-500 italic leading-tight">
                    {sbSelFinal.toFixed(1)} ≥ {inputs.sgMinS} × [{totalAg.toFixed(0)} / {totalBoltRootArea.toFixed(0)}] = {step5Threshold.toFixed(1)}
                  </div>
                  <div className={`flex justify-between items-center pt-1 border-t ${isStep5Ok ? 'border-indigo-50' : 'border-red-200'}`}>
                    <span className="text-[8px] font-bold uppercase opacity-60">Status</span>
                    <span className={`text-[11px] font-black ${isStep5Ok ? 'text-indigo-700' : 'text-red-700'}`}>
                      {isStep5Ok ? 'OK' : 'Not OK'}
                    </span>
                  </div>
                </div>

                <div className={`p-3 rounded-lg border shadow-sm space-y-2 flex flex-col justify-between transition-colors ${isStep6Ok ? 'bg-white border-indigo-100' : 'bg-red-50 border-red-200'}`}>
                  <div className={`text-[8.5px] font-black uppercase tracking-tighter ${isStep6Ok ? 'text-indigo-400' : 'text-red-700'}`}>Step 6. Sbsel ≥ (Sgmin-O Ag + pi()/4Pmax GI.D^2)/(fraction of gasket x Ab x nb)</div>
                  <div className="font-mono text-[9px] text-slate-500 italic leading-tight">
                    {sbSelFinal.toFixed(1)} ≥ ({inputs.sgMinO}×{totalAg.toFixed(0)} + (π/4)×{pMpa.toFixed(2)}×{results.seatingID.toFixed(0)}²) / ({(inputs.g || 1)}×{totalBoltRootArea.toFixed(0)}) = {step6Threshold.toFixed(1)}
                  </div>
                  <div className={`flex justify-between items-center pt-1 border-t ${isStep6Ok ? 'border-indigo-50' : 'border-red-200'}`}>
                    <span className="text-[8px] font-bold uppercase opacity-60">Status</span>
                    <span className={`text-[11px] font-black ${isStep6Ok ? 'text-indigo-700' : 'text-red-700'}`}>
                      {isStep6Ok ? 'OK' : 'Not OK'}
                    </span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm space-y-2 transition-all">
                  <div className="text-[8.5px] font-black text-indigo-400 uppercase tracking-tighter">Step 7. Sbsel ≤ Sgmax [Ag/(Abnb)]</div>
                  <div className="font-mono text-[10px] text-slate-600">
                    {sbSelFinal.toFixed(1)} ≤ {inputs.sgMax} × [{totalAg.toFixed(0)} / {totalBoltRootArea.toFixed(0)}] = {step7Threshold === Infinity ? '∞' : step7Threshold.toFixed(1)}
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-indigo-50">
                    <span className="text-[8px] font-bold text-slate-400 uppercase">Status</span>
                    <span className={`text-[11px] font-black uppercase tracking-widest ${isStep7Ok ? 'text-indigo-700' : 'text-red-600'}`}>
                      {isStep7Ok ? 'OK' : 'Not OK'}
                    </span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm space-y-2 transition-all">
                  <div className="text-[8.5px] font-black text-indigo-400 uppercase tracking-tighter">Step 8. Sbsel ≤ Sfmax(g/Φfmax)</div>
                  <div className="font-mono text-[10px] text-slate-600">
                    {sbSelFinal.toFixed(1)} ≤ {inputs.sfMax} × ({inputs.g || 1} / {inputs.phiFMax}) = {step8Threshold === Infinity ? '∞' : step8Threshold.toFixed(1)}
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-indigo-50">
                    <span className="text-[8px] font-bold text-slate-400 uppercase">Status</span>
                    <span className={`text-[11px] font-black uppercase tracking-widest ${isStep8Ok ? 'text-indigo-700' : 'text-red-600'}`}>
                      {isStep8Ok ? 'OK' : 'Not OK'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-50 border-t border-slate-100 px-6 py-2 flex items-center justify-between">
            <div className="flex gap-4">
               <div className="flex items-center gap-1.5">
                 <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">SgT:</span>
                 <span className="text-[10px] font-black text-slate-700">{inputs.sgT} MPa</span>
               </div>
               <div className="flex items-center gap-1.5">
                 <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Bolt Area:</span>
                 <span className="text-[10px] font-black text-slate-700">{(results.singleBoltArea * inputs.boltCount).toLocaleString(undefined, { maximumFractionDigits: 0 })} mm²</span>
               </div>
            </div>
            <div className={`px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter flex items-center gap-1.5 ${sbSelFinal <= inputs.sbMax && sbSelFinal >= inputs.sbMin && isStep5Ok && isStep6Ok && isStep7Ok && isStep8Ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              <i className={`fa-solid ${sbSelFinal <= inputs.sbMax && sbSelFinal >= inputs.sbMin && isStep5Ok && isStep6Ok && isStep7Ok && isStep8Ok ? 'fa-check-circle' : 'fa-circle-xmark'}`}></i>
              {sbSelFinal <= inputs.sbMax && sbSelFinal >= inputs.sbMin && isStep5Ok && isStep6Ok && isStep7Ok && isStep8Ok ? 'Stress Within Limit' : 'Check Bounds'}
            </div>
          </div>
        </div>
      )}

      <section className="w-full pt-4">
        <div className="flex justify-center">
          <button 
            onClick={() => {
              setActiveTab('current');
              setShowBackData(true);
            }}
            className="group flex items-center gap-3 bg-slate-900 hover:bg-black text-white px-8 py-3 rounded-full font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95"
          >
            <i className="fa-solid fa-database group-hover:animate-pulse"></i>
            Check BACK DATA Library
          </button>
        </div>
      </section>

      {showBackData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowBackData(false)}></div>
          <div className="relative w-full max-w-[95vw] lg:max-w-7xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-900 text-white p-6 flex justify-between items-center border-b border-white/10">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center shadow-lg shadow-sky-500/20">
                  <i className="fa-solid fa-book-open text-lg"></i>
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tighter">Engineering Reference Library</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">TEMA & ASME Standards Database</p>
                </div>
              </div>
              <button 
                onClick={() => setShowBackData(false)}
                className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white transition-all"
              >
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>

            <div className="bg-slate-50 border-b border-slate-200 px-6 flex items-center gap-2 overflow-x-auto no-scrollbar">
              {(['current', 'bolts', 'tensioning', 'stress', 'plate_stress', 'gaskets', 'rings', 'pcc1'] as TabId[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
                    activeTab === tab 
                      ? 'border-sky-500 text-sky-600' 
                      : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab === 'current' && 'Calculation Summary'}
                  {tab === 'bolts' && 'Bolt Specs (Table D-5)'}
                  {tab === 'tensioning' && 'Bolt Specs (Tensioning)'}
                  {tab === 'stress' && 'Bolt Stresses'}
                  {tab === 'plate_stress' && 'PLATE STRESS'}
                  {tab === 'gaskets' && 'Gasket Factors (Table 4.16.1)'}
                  {tab === 'rings' && 'Ring Standards'}
                  {tab === 'pcc1' && 'PCC-1 (API 660)'}
                </button>
              ))}
            </div>

            <div className="p-4 lg:p-8 space-y-8 max-h-[75vh] overflow-y-auto custom-scrollbar bg-white">
              {activeTab === 'current' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-sky-600 uppercase tracking-widest border-b border-sky-100 pb-2">Active Bolt Reference</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: "Selected Size", val: `${inputs.boltSize}"` },
                        { label: "B-MIN", val: `${currentBoltRef?.B_min}"` },
                        { label: "R (Radial Rh)", val: `${currentBoltRef?.R}"` },
                        { label: "E (Edge Dist.)", val: `${currentBoltRef?.E}"` },
                        { label: "Hole Size dH", val: `${currentBoltRef?.holeSize.toFixed(1)} mm` },
                        { label: "Tensile Area", val: `${(currentBoltRef?.tensileArea || 0).toFixed(1)} mm²` }
                      ].map((item, idx) => (
                        <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-100 shadow-sm">
                          <span className="block text-[8px] font-black text-slate-400 uppercase mb-1">{item.label}</span>
                          <span className="text-sm font-black text-slate-700 font-mono">{item.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest border-b border-amber-100 pb-2">Active Gasket Factors</h4>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm space-y-4">
                      <div>
                        <span className="block text-[8px] font-black text-slate-400 uppercase mb-2">Selected Type</span>
                        <span className="text-xs font-black text-slate-700">{inputs.gasketType}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-3 rounded-lg border border-amber-100">
                          <span className="block text-[8px] font-black text-amber-500 uppercase mb-1">M Factor</span>
                          <span className="text-xl font-black text-amber-700">{results.gasketM.toFixed(2)}</span>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-amber-100">
                          <span className="block text-[8px] font-black text-amber-500 uppercase mb-1">Y Factor (PSI)</span>
                          <span className="text-xl font-black text-amber-700">{results.gasketY}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'stress' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Bolt Allowable stress (S) matrix - MPa</h5>
                    <span className="text-[8px] font-bold text-slate-400 italic">Scroll horizontally to view all temperatures</span>
                  </div>
                  <div className="overflow-x-auto border rounded-xl shadow-lg relative bg-white">
                    <table className="w-full border-collapse border-spacing-0">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className={`${tableHeaderClass} sticky left-0 z-20 bg-slate-100 border-r min-w-[200px]`}>Material ID</th>
                          <th className={`${tableHeaderClass} border-r text-emerald-600`}>Min_Tensile</th>
                          <th className={`${tableHeaderClass} border-r text-emerald-600`}>Min_Yield</th>
                          {BOLT_TEMP_STEPS.map(temp => (
                            <th key={temp} className={`${tableHeaderClass} border-r text-center`}>{temp}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ASME_BOLT_MATERIALS.map((mat, i) => (
                          <tr key={i} className={mat.id === inputs.boltMaterial ? "bg-sky-50" : i % 2 === 0 ? "bg-white" : "bg-slate-50/30"}>
                            <td className={`${tableCellClass} sticky left-0 z-10 font-black text-xs border-r ${mat.id === inputs.boltMaterial ? 'bg-sky-100' : 'bg-inherit'}`}>
                              {mat.id}
                            </td>
                            <td className={`${tableCellClass} border-r text-center font-bold text-slate-500`}>{mat.minTensile || '-'}</td>
                            <td className={`${tableCellClass} border-r text-center font-bold text-slate-500`}>{mat.minYield || '-'}</td>
                            {BOLT_TEMP_STEPS.map((temp, idx) => {
                              const stressVal = mat.stresses[idx];
                              return (
                                <td key={idx} className={`${tableCellClass} border-r text-center`}>
                                  {stressVal !== undefined && stressVal !== null ? stressVal : ''}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'plate_stress' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Plate Allowable stress (S) matrix - MPa</h5>
                    <span className="text-[8px] font-bold text-slate-400 italic">Scroll horizontally to view all temperatures</span>
                  </div>
                  <div className="overflow-x-auto border rounded-xl shadow-lg relative bg-white">
                    <table className="w-full border-collapse border-spacing-0">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className={`${tableHeaderClass} sticky left-0 z-20 bg-slate-100 border-r min-w-[200px]`}>Material ID</th>
                          <th className={`${tableHeaderClass} border-r text-emerald-600`}>Min_Tensile</th>
                          <th className={`${tableHeaderClass} border-r text-emerald-600`}>Min_Yield</th>
                          {BOLT_TEMP_STEPS.map(temp => (
                            <th key={temp} className={`${tableHeaderClass} border-r text-center`}>{temp}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ASME_PLATE_MATERIALS.map((mat, i) => (
                          <tr key={i} className={mat.id === inputs.shellMaterial ? "bg-sky-50" : i % 2 === 0 ? "bg-white" : "bg-slate-50/30"}>
                            <td className={`${tableCellClass} sticky left-0 z-10 font-black text-xs border-r ${mat.id === inputs.shellMaterial ? 'bg-sky-100' : 'bg-inherit'}`}>
                              {mat.id}
                            </td>
                            <td className={`${tableCellClass} border-r text-center font-bold text-slate-500`}>{mat.minTensile || '-'}</td>
                            <td className={`${tableCellClass} border-r text-center font-bold text-slate-500`}>{mat.minYield || '-'}</td>
                            {BOLT_TEMP_STEPS.map((temp, idx) => {
                              const stressVal = mat.stresses[idx];
                              return (
                                <td key={idx} className={`${tableCellClass} border-r text-center`}>
                                  {stressVal !== undefined && stressVal !== null ? stressVal : ''}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'pcc1' && (
                <div className="space-y-6">
                  <div className="flex flex-col gap-2">
                    <h4 className="text-[14px] font-black text-slate-800 uppercase tracking-tight">Table 3—Assembly Gasket Stress</h4>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">PCC-1 (API 660) Engineering Reference</p>
                  </div>
                  
                  <div className="overflow-x-auto border rounded-xl shadow-sm">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className={`${tableHeaderClass} min-w-[200px]`}>Peripheral Gasket Type</th>
                          <th className={tableHeaderClass}>Max Permissible Stress (Sgmax)<br/><span className="lowercase font-bold opacity-60">MPa (psi)</span></th>
                          <th className={tableHeaderClass}>Min Seating Stress (Sgmin-S)<br/><span className="lowercase font-bold opacity-60">MPa (psi)</span></th>
                          <th className={tableHeaderClass}>Min Operating Stress (Sgmin-O)<br/><span className="lowercase font-bold opacity-60">MPa (psi)</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {API660_PCC1_STRESS_TABLE.map((row, i) => (
                          <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/30"}>
                            <td className={`${tableCellClass} font-black text-slate-800 border-r`}>{row.type}</td>
                            <td className={`${tableCellClass} border-r text-center font-bold`}>{row.sgMax}</td>
                            <td className={`${tableCellClass} border-r text-center font-bold`}>{row.sgMinS}</td>
                            <td className={`${tableCellClass} text-center font-bold`}>{row.sgMinO}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="text-[9px] text-slate-500 leading-relaxed italic">
                      <span className="font-black not-italic text-slate-700 mr-1">a.</span>
                      These stresses are based on the use of facing layers or filler materials, such as flexible graphite, PTFE, or other conformable materials, and excludes core materials of carbon steel, brass, copper, or aluminum alloys.
                    </div>
                    <div className="text-[9px] text-slate-500 leading-relaxed italic">
                      <span className="font-black not-italic text-slate-700 mr-1">b.</span>
                      The maximum permissible gasket stress does not apply when a means to prevent over-compression of the gasket is employed (e.g. centering rings with spiral-wound gaskets).
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'bolts' && (
                <div className="overflow-x-auto border rounded-xl shadow-sm">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className={tableHeaderClass}>Size (in)</th>
                        <th className={tableHeaderClass}>R (in)</th>
                        <th className={tableHeaderClass}>B-MIN</th>
                        <th className={tableHeaderClass}>B-MIN(WHC STD)</th>
                        <th className={tableHeaderClass}>E (in)</th>
                        <th className={tableHeaderClass}>Hole dH (mm)</th>
                        <th className={tableHeaderClass}>Area (mm²)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {TEMA_BOLT_DATA.map((bolt, i) => (
                        <tr key={i} className={bolt.size === inputs.boltSize ? "bg-sky-50" : ""}>
                          <td className={`${tableCellClass} font-black`}>{bolt.size}"</td>
                          <td className={tableCellClass}>{bolt.R}</td>
                          <td className={tableCellClass}>{bolt.B_min}</td>
                          <td className={`${tableCellClass} font-black text-sky-600`}>{bolt.bMinWhc || '-'}</td>
                          <td className={tableCellClass}>{bolt.E}</td>
                          <td className={tableCellClass}>{bolt.holeSize.toFixed(1)}</td>
                          <td className={tableCellClass}>{bolt.tensileArea.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'tensioning' && (
                <div className="overflow-x-auto border rounded-xl shadow-sm max-w-lg mx-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className={tableHeaderClass}>Bolt Size (in)</th>
                        <th className={tableHeaderClass}>B_ten (in)</th>
                        <th className={tableHeaderClass}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {HYDRAULIC_TENSIONING_DATA.map((item, i) => (
                        <tr key={i} className={item.size === inputs.boltSize ? "bg-sky-50" : ""}>
                          <td className={`${tableCellClass} font-black`}>{item.size}"</td>
                          <td className={tableCellClass}>{item.B_ten}</td>
                          <td className={tableCellClass}>
                            {item.size === inputs.boltSize ? (
                              <span className="text-[8px] bg-sky-600 text-white px-1.5 py-0.5 rounded-full font-black">ACTIVE</span>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'gaskets' && (
                <div className="overflow-x-auto border rounded-xl shadow-sm">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className={tableHeaderClass}>Gasket Material</th>
                        <th className={tableHeaderClass}>Gasket Factor, m</th>
                        <th className={tableHeaderClass}>Min. Design Seating Stress, y <br/><span className="lowercase font-bold opacity-60">MPa (psi)</span></th>
                        <th className={tableHeaderClass}>Facing Sketch</th>
                      </tr>
                    </thead>
                    <tbody>
                      {GASKET_TYPES.map((g, i) => (
                        <tr key={i} className={g.id === inputs.gasketType ? "bg-sky-50" : ""}>
                          <td className={`${tableCellClass} font-black text-slate-800`}>{g.id}</td>
                          <td className={`${tableCellClass} text-center`}>{g.m.toFixed(2)}</td>
                          <td className={`${tableCellClass} text-center font-bold`}>
                            {(g.y * 0.00689476).toFixed(0)} ({g.y.toLocaleString()})
                          </td>
                          <td className={`${tableCellClass} text-center italic text-slate-400`}>{g.sketches}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'rings' && (
                <div className="overflow-x-auto border rounded-xl shadow-sm">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className={tableHeaderClass}>Shell ID Range (mm)</th>
                        <th className={tableHeaderClass}>Min IR Width (mm)</th>
                        <th className={tableHeaderClass}>Min OR Width (mm)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {GASKET_RING_TABLE.map((ring, i) => {
                        const isActive = inputs.insideDia >= ring.min && inputs.insideDia <= ring.max;
                        return (
                          <tr key={i} className={isActive ? "bg-sky-50" : ""}>
                            <td className={tableCellClass}>{ring.min} ~ {ring.max === 100000 ? '∞' : ring.max}</td>
                            <td className={tableCellClass}>{ring.irMin}</td>
                            <td className={tableCellClass}>{ring.orMin}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
