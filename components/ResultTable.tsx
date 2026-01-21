import React, { useState } from 'react';
import { CalculationResults, FlangeInputs } from '../types';
import { TEMA_BOLT_DATA } from '../constants';

interface Props {
  inputs: FlangeInputs;
  results: CalculationResults;
}

export const ResultTable: React.FC<Props> = ({ inputs, results }) => {
  const [showDetails, setShowDetails] = useState(false);
  const boltRef = TEMA_BOLT_DATA.find(b => b.size === inputs.boltSize);

  // Spacing logic
  const physicalPitch = results.geometricPitch;
  const isPitchTooSmall = physicalPitch < results.boltSpacingMin - 0.1;
  const isPitchTooLarge = physicalPitch > results.maxBoltSpacing + 0.1;
  const spacingStatus = isPitchTooSmall ? "PITCH TOO SMALL" : (isPitchTooLarge ? "PITCH TOO LARGE" : "PITCH OK");
  const spacingStatusColor = isPitchTooSmall || isPitchTooLarge ? "bg-red-500" : "bg-emerald-500";
  const pitchValueColor = isPitchTooSmall || isPitchTooLarge ? "text-red-600" : "text-emerald-600";

  const cardBaseClass = "bg-slate-50/50 p-4 rounded-xl border border-slate-100 transition-all shadow-sm";
  const cardActiveBaseClass = "bg-sky-50/50 p-4 rounded-xl border border-sky-200 transition-all shadow-md ring-1 ring-sky-100";
  
  const titleClass = "text-[11px] font-black text-sky-700 uppercase tracking-tight mb-2 block";
  const detailTextClass = "text-[9px] font-bold text-slate-300 uppercase tracking-tight leading-tight mb-1";
  const substitutionTextClass = "text-[9px] font-bold text-slate-300 lowercase italic tracking-tight mb-3";
  const resultTextClass = "text-sm font-black text-slate-700 tabular-nums flex items-baseline gap-1";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-tighter">
          <i className="fa-solid fa-list-ol text-sky-600"></i> BCD Calculation
        </h2>
        <button 
          onClick={() => setShowDetails(!showDetails)}
          className={`text-[8px] font-black px-4 py-1.5 rounded-full transition-all flex items-center gap-2 border ${
            showDetails 
            ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-100' 
            : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <i className={`fa-solid ${showDetails ? 'fa-eye-slash' : 'fa-eye'}`}></i>
          DETAIL
        </button>
      </div>

      {/* Method Cards */}
      <div className="grid grid-cols-1 gap-3">
        {/* Method 1 */}
        <div className={results.selectedBcdSource === 1 ? cardActiveBaseClass : cardBaseClass}>
          <div className="flex justify-between items-start mb-1">
            <span className={titleClass}>1. TEMA MIN PITCH</span>
            {results.selectedBcdSource === 1 && (
              <span className="text-[8px] bg-sky-600 text-white px-2 py-0.5 rounded-full font-black uppercase">MAX</span>
            )}
          </div>
          
          {showDetails && (
            <div className="animate-in fade-in duration-300">
              <div className={detailTextClass}>(B_min × Bolt EA) / π</div>
              <div className={substitutionTextClass}>
                ({boltRef?.B_min.toFixed(4)}" × {inputs.boltCount}) / π =
              </div>
            </div>
          )}
          
          <div className={resultTextClass}>
            {results.bcdMethod1.toFixed(0)} <small className="text-[10px] opacity-40">mm</small>
          </div>
        </div>

        {/* Method 2 */}
        <div className={results.selectedBcdSource === 2 ? cardActiveBaseClass : cardBaseClass}>
          <div className="flex justify-between items-start mb-1">
            <span className={titleClass}>2. HUB / RADIAL LOGIC</span>
            {results.selectedBcdSource === 2 && (
              <span className="text-[8px] bg-sky-600 text-white px-2 py-0.5 rounded-full font-black uppercase">MAX</span>
            )}
          </div>

          {showDetails && (
            <div className="animate-in fade-in duration-300">
              <div className={detailTextClass}>ID + (g1 × 2) + (R × 2)</div>
              <div className={substitutionTextClass}>
                {inputs.insideDia} + ({inputs.g1} × 2) + ({boltRef?.R.toFixed(4)}" × 2) =
              </div>
            </div>
          )}

          <div className={resultTextClass}>
            {results.bcdMethod2.toFixed(0)} <small className="text-[10px] opacity-40">mm</small>
          </div>
        </div>

        {/* Method 3 */}
        <div className={results.selectedBcdSource === 3 ? cardActiveBaseClass : cardBaseClass}>
          <div className="flex justify-between items-start mb-1">
            <span className={titleClass}>3. GASKET & CLEARANCE</span>
            {results.selectedBcdSource === 3 && (
              <span className="text-[8px] bg-sky-600 text-white px-2 py-0.5 rounded-full font-black uppercase">MAX</span>
            )}
          </div>

          {showDetails && (
            <div className="animate-in fade-in duration-300">
              <div className={detailTextClass}>GasketOD + (B × 2) + (C × 2) + BoltHole</div>
              <div className={substitutionTextClass}>
                {results.gasketOD.toFixed(1)} + (1.5 × 2) + ({results.effectiveC} × 2) + {results.boltHoleSize} =
              </div>
            </div>
          )}

          <div className={resultTextClass}>
            {results.bcdMethod3.toFixed(2)} <small className="text-[10px] opacity-40">mm</small>
          </div>
        </div>
      </div>

      {/* Bolt Spacing Info */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex justify-between items-center mb-1">
          <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <i className="fa-solid fa-arrows-left-right"></i> Bolt Spacing Info
          </h3>
          <span className={`${spacingStatusColor} text-white text-[8px] font-black px-2 py-0.5 rounded uppercase`}>
            {spacingStatus}
          </span>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] font-bold">
            <span className="text-slate-500">Min Allowable Pitch:</span>
            <span className="text-slate-800 tabular-nums">{results.boltSpacingMin.toFixed(2)} mm</span>
          </div>
          <div className="flex justify-between text-[10px] font-bold">
            <span className="text-slate-500 italic">Geometric Pitch:</span>
            <span className={`${pitchValueColor} tabular-nums`}>{physicalPitch.toFixed(2)} mm</span>
          </div>
          <div className="flex justify-between text-[10px] font-bold border-t border-slate-50 pt-1.5">
            <span className="text-slate-500 italic">Max bolt pitch (WHC Standard):</span>
            <span className="text-amber-600 tabular-nums border-b border-dotted border-amber-600">{results.maxBoltSpacing.toFixed(2)} mm</span>
          </div>
        </div>
      </div>

      {/* Gasket Breakdown */}
      <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3">
        <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
          <i className="fa-solid fa-circle-info"></i> Gasket Breakdown
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-bold">
            <span className="text-slate-400">Inner Ring (IR):</span>
            <span className="text-slate-600">{results.innerRingWidth.toFixed(1)} mm</span>
          </div>
          <div className="flex justify-between text-[10px] font-bold">
            <span className="text-slate-400">Outer Ring (OR):</span>
            <span className="text-slate-600">{results.outerRingWidth.toFixed(1)} mm</span>
          </div>
          
          <div className="pt-2 border-t border-slate-200/50 space-y-2">
            <div>
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] font-bold text-sky-700">Gasket Seal OD:</span>
                <span className="text-[11px] font-black text-sky-800 border-b-2 border-sky-200 tabular-nums">{results.seatingOD.toFixed(1)} mm</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] font-bold text-sky-700">Gasket Seal ID:</span>
                <span className="text-[11px] font-black text-sky-800 border-b-2 border-sky-200 tabular-nums">{results.seatingID.toFixed(1)} mm</span>
              </div>
            </div>
            
            <div className="pt-2">
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] font-black text-slate-800 uppercase">TOTAL GASKET O.D</span>
                <span className="text-[11px] font-black text-slate-900 tabular-nums">{results.gasketOD.toFixed(1)} mm</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Flange OD Logic */}
      <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100/50 space-y-3">
        <h3 className="text-[9px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
          <i className="fa-solid fa-expand"></i> Flange OD Logic (TEMA)
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-amber-500 italic">Formula:</span>
            <span className="text-[10px] font-black text-slate-700">BCD + (2 × E)</span>
          </div>
          <div className="flex justify-between items-center border-t border-amber-200/50 pt-2">
            <span className="text-[10px] font-bold text-slate-500 tabular-nums">
              {results.finalBCD.toFixed(1)} + (2 × {results.edgeDistance.toFixed(2)})
            </span>
            <span className="text-sm font-black text-amber-700 flex items-baseline gap-1">
              = {results.finalOD.toFixed(0)} <small className="text-[10px]">mm</small>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
