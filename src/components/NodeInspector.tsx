import React from 'react';

export default function NodeInspector({ node, onChange }: { node: any, onChange: (id: string, conf: any) => void }) {
  const config = node.data.config || { instances: 1 };
  const serviceId = node.data.id?.toLowerCase() || '';

  const handleUpdate = (updates: any) => {
    onChange(node.id, updates);
  };

  return (
    <div className="flex flex-col gap-4 text-sm text-gray-300">
      <h2 className="text-xl font-bold mb-1 border-b border-gray-800 pb-2 text-white">
         <span className="text-indigo-400">Configure:</span> {node.data.name}
      </h2>

      {/* Global Setting for all nodes */}
      <div>
         <label className="text-xs text-gray-400 mb-1 block">Instances / Count</label>
         <input 
           type="number" min="1" 
           className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white outline-none focus:border-indigo-500" 
           value={config.instances || 1} 
           onChange={e => handleUpdate({ instances: parseInt(e.target.value) || 1 })} 
         />
      </div>

      {/* EC2 Specifics */}
      {serviceId === 'ec2' && (
         <div className="flex flex-col gap-4 bg-gray-800/50 p-4 border border-gray-800 rounded-lg">
            <div>
               <label className="text-xs text-indigo-400 mb-1 block">Operating System</label>
               <select 
                  className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white outline-none"
                  value={config.os || 'Linux'}
                  onChange={e => handleUpdate({ os: e.target.value })}
               >
                  <option value="Linux">Linux</option>
                  <option value="Windows">Windows</option>
               </select>
            </div>
            <div>
               <label className="text-xs text-indigo-400 mb-1 block">Instance Type</label>
               <select 
                  className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white outline-none"
                  value={config.instanceType || 't3.micro'}
                  onChange={e => handleUpdate({ instanceType: e.target.value })}
               >
                  <option value="t3.micro">t3.micro</option>
                  <option value="t3.medium">t3.medium</option>
                  <option value="m5.large">m5.large</option>
                  <option value="c5.large">c5.large</option>
               </select>
            </div>
            <div>
               <label className="text-xs text-indigo-400 mb-1 block">Purchase Option</label>
               <select 
                  className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white outline-none"
                  value={config.purchaseOption || 'on-demand'}
                  onChange={e => handleUpdate({ purchaseOption: e.target.value })}
               >
                  <optgroup label="No Commitment">
                     <option value="on-demand">On-Demand</option>
                     <option value="spot">Spot Instance</option>
                     <option value="dedicated-host">Dedicated Host</option>
                  </optgroup>
                  <optgroup label="Savings Plans">
                     <option value="sp-1yr-no">1-Year SP (No Upfront)</option>
                     <option value="sp-1yr-partial">1-Year SP (Partial Upfront)</option>
                     <option value="sp-1yr-all">1-Year SP (All Upfront)</option>
                     <option value="sp-3yr-no">3-Year SP (No Upfront)</option>
                     <option value="sp-3yr-partial">3-Year SP (Partial Upfront)</option>
                     <option value="sp-3yr-all">3-Year SP (All Upfront)</option>
                  </optgroup>
                  <optgroup label="Reserved Instances (RI)">
                     <option value="ri-1yr-std">1-Year RI (Standard)</option>
                     <option value="ri-3yr-std">3-Year RI (Standard)</option>
                     <option value="ri-1yr-conv">1-Year RI (Convertible)</option>
                     <option value="ri-3yr-conv">3-Year RI (Convertible)</option>
                  </optgroup>
               </select>
            </div>
            <div>
               <label className="text-xs text-indigo-400 mb-1 block">Hours per Month</label>
               <input 
                 type="number" min="1" max="730"
                 className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white outline-none" 
                 value={config.hours || 730} 
                 onChange={e => handleUpdate({ hours: parseInt(e.target.value) || 0 })} 
               />
               <div className="text-[10px] text-gray-500 mt-1">Default 730 hrs is 24/7 uptime</div>
            </div>
         </div>
      )}

      {/* S3 Specifics */}
      {serviceId === 's3' && (
         <div className="flex flex-col gap-4 bg-gray-800/50 p-4 border border-gray-800 rounded-lg">
            <div>
               <label className="text-xs text-indigo-400 mb-1 block">Total Storage (GB/mo)</label>
               <input 
                 type="number" min="0" step="10"
                 className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white outline-none" 
                 value={config.storageGB ?? 100} 
                 onChange={e => handleUpdate({ storageGB: parseInt(e.target.value) || 0 })} 
               />
            </div>
            <div>
               <label className="text-xs text-indigo-400 mb-1 block">Data Transfer Out (GB)</label>
               <input 
                 type="number" min="0" step="50"
                 className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white outline-none" 
                 value={config.dataOutGB ?? 50} 
                 onChange={e => handleUpdate({ dataOutGB: parseInt(e.target.value) || 0 })} 
               />
            </div>
         </div>
      )}

      {/* Lambda Specifics */}
      {serviceId === 'lambda' && (
         <div className="flex flex-col gap-4 bg-gray-800/50 p-4 border border-gray-800 rounded-lg">
            <div>
               <label className="text-xs text-indigo-400 mb-1 block">Memory Allocated (MB)</label>
               <select 
                  className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white outline-none"
                  value={config.memoryMB || 512}
                  onChange={e => handleUpdate({ memoryMB: parseInt(e.target.value) })}
               >
                  <option value="128">128 MB</option>
                  <option value="512">512 MB</option>
                  <option value="1024">1 GB</option>
                  <option value="4096">4 GB</option>
               </select>
            </div>
            <div>
               <label className="text-xs text-indigo-400 mb-1 block">Invocations per Month (Millions)</label>
               <input 
                 type="number" min="0" step="1"
                 className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white outline-none" 
                 value={config.invocations1M ?? 1} 
                 onChange={e => handleUpdate({ invocations1M: parseFloat(e.target.value) || 0 })} 
               />
            </div>
            <div>
               <label className="text-xs text-indigo-400 mb-1 block">Avg Duration (ms)</label>
               <input 
                 type="number" min="1" step="50"
                 className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white outline-none" 
                 value={config.durationMs || 200} 
                 onChange={e => handleUpdate({ durationMs: parseInt(e.target.value) || 0 })} 
               />
            </div>
         </div>
      )}

      {/* RDS Specifics */}
      {serviceId === 'rds' && (
         <div className="flex flex-col gap-4 bg-gray-800/50 p-4 border border-gray-800 rounded-lg">
            <div>
               <label className="text-xs text-indigo-400 mb-1 block">Instance Class</label>
               <select 
                  className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white outline-none"
                  value={config.instanceClass || 'db.t3.micro'}
                  onChange={e => handleUpdate({ instanceClass: e.target.value })}
               >
                  <option value="db.t3.micro">db.t3.micro</option>
                  <option value="db.t3.medium">db.t3.medium</option>
                  <option value="db.m5.large">db.m5.large</option>
               </select>
            </div>
            <div className="flex items-center gap-2">
               <input 
                 type="checkbox" 
                 className="accent-indigo-500 w-4 h-4 cursor-pointer"
                 checked={config.multiAZ || false}
                 onChange={e => handleUpdate({ multiAZ: e.target.checked })}
               />
               <label className="text-xs text-indigo-400 cursor-pointer" onClick={() => handleUpdate({ multiAZ: !(config.multiAZ || false) })}>
                  Multi-AZ (High Availability)
               </label>
            </div>
         </div>
      )}
      
      {!['ec2', 's3', 'lambda', 'rds'].includes(serviceId) && (
         <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-xs text-indigo-300">
            Advanced multi-dimensional configurations coming soon for this service. Currently estimating via base regional rate.
         </div>
      )}
      
      <div className="mt-auto pt-6 border-t border-gray-800 flex justify-between items-center pb-2">
         <span className="font-bold text-gray-500">Instance Total</span>
         <span className="text-2xl font-bold text-indigo-400 font-mono">${(node.data.price || 0).toFixed(2)}</span>
      </div>
    </div>
  );
}
