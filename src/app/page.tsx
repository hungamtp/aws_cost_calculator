"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  ReactFlow, Controls, Background, addEdge, 
  useNodesState, useEdgesState, Handle, Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { LayoutGrid, Wand2, BookOpen } from 'lucide-react';
import { getAwsServicesCatalog, AwsServiceCat } from '../actions/awsPricing';

// --- CUSTOM NODE ---
const ServiceNode = ({ data }: any) => {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 w-48 shadow-xl text-white">
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-gray-500" />
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded bg-indigo-600"></div>
        <span className="font-semibold text-sm">{data.name}</span>
      </div>
      <div className="flex justify-between items-center text-xs text-gray-400">
        <span>Instances:</span>
        <input 
          type="number" 
          defaultValue={1} 
          min={1} 
          className="w-12 bg-gray-800 text-white rounded px-1 text-right border border-gray-700" 
        />
      </div>
      <div className="mt-2 pt-2 border-t border-gray-700 font-mono text-sm text-right text-indigo-400">
        ${data.price.toFixed(2)}/mo
      </div>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-gray-500" />
    </div>
  );
};

const nodeTypes = { serviceNode: ServiceNode };

// --- MAIN PAGE ---
export default function CostEstimatorApp() {
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  const [activeLeftPanel, setActiveLeftPanel] = useState<'none' | 'wizard' | 'examples'>('none');
  const [categories, setCategories] = useState<AwsServiceCat[]>([]);
  const [region, setRegion] = useState("US East (N. Virginia)");
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getAwsServicesCatalog(region).then(data => {
       setCategories(data);
       
       // Dynamically update the prices of any nodes already placed on the canvas
       setNodes((currentNodes) => {
          if (currentNodes.length === 0) return currentNodes;
          return currentNodes.map(node => {
             for (const cat of data) {
                const found = cat.services.find(s => s.id === node.data.id);
                if (found) {
                   return { ...node, data: { ...node.data, price: found.price } };
                }
             }
             return node;
          });
       });
    });
  }, [region, setNodes]);

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const onDragOver = useCallback((event: any) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: any) => {
      event.preventDefault();
      
      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      const serviceData = event.dataTransfer.getData('application/reactflow');
      
      if (typeof serviceData === 'undefined' || !serviceData || !reactFlowBounds) {
        return;
      }

      const parsedData = JSON.parse(serviceData);
      
      const position = {
        x: event.clientX - reactFlowBounds.left - 80,
        y: event.clientY - reactFlowBounds.top - 40,
      };

      const newNode = {
        id: `node-${Date.now()}`,
        type: 'serviceNode',
        position,
        data: { name: parsedData.name, price: parsedData.price, id: parsedData.id },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes]
  );

  const onDragStart = (event: any, service: any) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(service));
    event.dataTransfer.effectAllowed = 'move';
  };

  const calculateTotal = () => {
    return nodes.reduce((sum, n) => sum + (n.data.price || 0), 0).toFixed(2);
  };

  return (
    <div className="flex h-screen w-screen bg-gray-950 text-white overflow-hidden font-sans">
      
      {/* LEFT NAVIGATION */}
      <nav className="w-[60px] bg-black border-r border-gray-800 flex flex-col items-center py-6 gap-6 z-10 shrink-0">
        <button 
           className={`relative p-2 rounded-lg transition-all ${activeLeftPanel === 'none' ? 'text-indigo-400 bg-indigo-500/15 before:absolute before:-left-[10px] before:top-1/2 before:-translate-y-1/2 before:w-[3px] before:h-5 before:bg-indigo-500 before:rounded-r before:shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'text-gray-500 hover:text-white hover:bg-white/10'}`}
           onClick={() => setActiveLeftPanel('none')}
           title="Canvas"
        >
          <LayoutGrid size={24} />
        </button>
        <button 
           className={`relative p-2 rounded-lg transition-all ${activeLeftPanel === 'wizard' ? 'text-indigo-400 bg-indigo-500/15 before:absolute before:-left-[10px] before:top-1/2 before:-translate-y-1/2 before:w-[3px] before:h-5 before:bg-indigo-500 before:rounded-r before:shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'text-gray-500 hover:text-white hover:bg-white/10'}`}
           onClick={() => setActiveLeftPanel(activeLeftPanel === 'wizard' ? 'none' : 'wizard')}
           title="Smart Intake Wizard"
        >
          <Wand2 size={24} />
        </button>
        <button 
           className={`relative p-2 rounded-lg transition-all ${activeLeftPanel === 'examples' ? 'text-indigo-400 bg-indigo-500/15 before:absolute before:-left-[10px] before:top-1/2 before:-translate-y-1/2 before:w-[3px] before:h-5 before:bg-indigo-500 before:rounded-r before:shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'text-gray-500 hover:text-white hover:bg-white/10'}`}
           onClick={() => setActiveLeftPanel(activeLeftPanel === 'examples' ? 'none' : 'examples')}
           title="Architecture Examples"
        >
          <BookOpen size={24} />
        </button>
      </nav>

      {/* WIZARD SIDEBAR (SLIDE OVER) */}
      <div className={`absolute top-[70px] left-[60px] bottom-0 w-[380px] bg-gray-900 border-r border-gray-800 shadow-2xl transition-all duration-400 z-20 overflow-y-auto px-5 py-6 ${activeLeftPanel === 'wizard' ? 'translate-x-0 opacity-100 pointer-events-auto' : '-translate-x-full opacity-0 pointer-events-none'}`}>
         <h2 className="text-xl font-bold mb-1 border-b border-gray-800 pb-2">Smart Intake Form</h2>
         <p className="text-gray-400 text-xs mb-5 pt-1">Describe your workload and automatically generate infrastructure.</p>
         
         <div className="mb-6">
            <h3 className="text-indigo-400 font-semibold border-b border-gray-800 pb-2 mb-4">Step 1: Application Type</h3>
            <div className="flex flex-wrap gap-2">
                <button className="px-3 py-1 bg-indigo-600/30 border border-indigo-500 text-indigo-300 rounded-full text-xs">Web / API</button>
                <button className="px-3 py-1 bg-gray-800 rounded-full text-xs hover:bg-gray-700">Data Pipeline</button>
                <button className="px-3 py-1 bg-gray-800 rounded-full text-xs hover:bg-gray-700">Machine Learning</button>
            </div>
         </div>

         <div className="mb-6">
            <h3 className="text-indigo-400 font-semibold border-b border-gray-800 pb-2 mb-4">Step 2: Traffic</h3>
            <label className="text-sm text-gray-300 block mb-2">Monthly Active Users (MAU)</label>
            <input type="range" min="1" max="5" defaultValue="3" className="w-full accent-indigo-500" />
            <div className="flex justify-between text-gray-500 text-xs mt-1">
                <span>1K</span><span>100K+</span>
            </div>
         </div>

         <div className="mb-6">
            <h3 className="text-indigo-400 font-semibold border-b border-gray-800 pb-2 mb-4">Step 3: Database</h3>
            <div className="flex flex-wrap gap-2">
                <button className="px-3 py-1 bg-indigo-600/30 border border-indigo-500 text-indigo-300 rounded-full text-xs">Managed RDS</button>
                <button className="px-3 py-1 bg-gray-800 rounded-full text-xs hover:bg-gray-700">DynamoDB NoSQL</button>
            </div>
         </div>

         <button 
           className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-semibold text-sm mt-4 text-white shadow-lg shadow-indigo-600/20 transition-all"
           onClick={() => {
              setActiveLeftPanel('none');
              // Mock auto-generation of nodes from Intake Form
              setNodes([
                { id: 'gen1', type: 'serviceNode', position: { x: 50, y: 150 }, data: { name: 'Amazon CloudFront', price: 8.50, id: 'cloudfront' } },
                { id: 'gen2', type: 'serviceNode', position: { x: 300, y: 150 }, data: { name: 'Amazon EC2', price: 25.40, id: 'ec2' } },
                { id: 'gen3', type: 'serviceNode', position: { x: 550, y: 150 }, data: { name: 'Amazon RDS', price: 15.20, id: 'rds' } }
              ]);
              setEdges([
                { id: 'e1-2', source: 'gen1', target: 'gen2', animated: true },
                { id: 'e2-3', source: 'gen2', target: 'gen3' }
              ]);
           }}
         >
           Apply Architecture to Canvas
         </button>
      </div>

      {/* EXAMPLES SIDEBAR (SLIDE OVER) */}
      <div className={`absolute top-[70px] left-[60px] bottom-0 w-[380px] bg-gray-900 border-r border-gray-800 shadow-2xl transition-all duration-400 z-20 overflow-y-auto px-5 py-6 ${activeLeftPanel === 'examples' ? 'translate-x-0 opacity-100 pointer-events-auto' : '-translate-x-full opacity-0 pointer-events-none'}`}>
         <h2 className="text-xl font-bold mb-1 border-b border-gray-800 pb-2">Architecture Examples</h2>
         <p className="text-gray-400 text-xs mb-5 pt-1">Load fully pre-configured best-practice templates to jumpstart your design.</p>
         
         <div className="flex flex-col gap-4">
             <button 
                 className="text-left bg-gray-800 border border-gray-700 p-4 rounded-lg hover:border-indigo-500 hover:bg-gray-800/80 transition-all group"
                 onClick={() => {
                    setActiveLeftPanel('none');
                    setNodes([
                      { id: 'ex-web1', type: 'serviceNode', position: { x: 50, y: 100 }, data: { name: 'Amazon CloudFront', price: 8.50, id: 'cloudfront' } },
                      { id: 'ex-web2', type: 'serviceNode', position: { x: 300, y: 50 }, data: { name: 'Amazon S3', price: 5.00, id: 's3' } },
                      { id: 'ex-web3', type: 'serviceNode', position: { x: 300, y: 200 }, data: { name: 'Amazon EC2', price: 25.40, id: 'ec2' } },
                      { id: 'ex-web4', type: 'serviceNode', position: { x: 550, y: 200 }, data: { name: 'Amazon RDS', price: 15.20, id: 'rds' } }
                    ]);
                    setEdges([
                      { id: 'e-web-1', source: 'ex-web1', target: 'ex-web2', animated: true },
                      { id: 'e-web-2', source: 'ex-web1', target: 'ex-web3', animated: true },
                      { id: 'e-web-3', source: 'ex-web3', target: 'ex-web4' }
                    ]);
                 }}
             >
                 <h4 className="font-semibold text-indigo-400 mb-1 group-hover:text-indigo-300">3-Tier Web Application</h4>
                 <p className="text-xs text-gray-400 leading-relaxed">A traditional scalable web app using CloudFront, S3 for static assets, EC2 for backend, and RDS for database.</p>
             </button>

             <button 
                 className="text-left bg-gray-800 border border-gray-700 p-4 rounded-lg hover:border-indigo-500 hover:bg-gray-800/80 transition-all group"
                 onClick={() => {
                    setActiveLeftPanel('none');
                    setNodes([
                      { id: 'ex-srv1', type: 'serviceNode', position: { x: 50, y: 150 }, data: { name: 'Amazon API Gateway', price: 3.50, id: 'apigateway' } },
                      { id: 'ex-srv2', type: 'serviceNode', position: { x: 300, y: 150 }, data: { name: 'AWS Lambda', price: 2.00, id: 'lambda' } },
                      { id: 'ex-srv3', type: 'serviceNode', position: { x: 550, y: 150 }, data: { name: 'Amazon DynamoDB', price: 1.25, id: 'dynamodb' } }
                    ]);
                    setEdges([
                      { id: 'e-srv-1', source: 'ex-srv1', target: 'ex-srv2', animated: true },
                      { id: 'e-srv-2', source: 'ex-srv2', target: 'ex-srv3' }
                    ]);
                 }}
             >
                 <h4 className="font-semibold text-indigo-400 mb-1 group-hover:text-indigo-300">Serverless REST API</h4>
                 <p className="text-xs text-gray-400 leading-relaxed">A fully managed serverless API structure using API Gateway, Lambda compute, and DynamoDB.</p>
             </button>
             
             <button 
                 className="text-left bg-gray-800 border border-gray-700 p-4 rounded-lg hover:border-indigo-500 hover:bg-gray-800/80 transition-all group"
                 onClick={() => {
                    setActiveLeftPanel('none');
                    setNodes([
                      { id: 'ex-dl1', type: 'serviceNode', position: { x: 50, y: 150 }, data: { name: 'Amazon Kinesis', price: 15.00, id: 'kinesis' } },
                      { id: 'ex-dl2', type: 'serviceNode', position: { x: 300, y: 150 }, data: { name: 'Amazon S3', price: 5.00, id: 's3' } },
                      { id: 'ex-dl3', type: 'serviceNode', position: { x: 550, y: 80 }, data: { name: 'AWS Glue', price: 12.00, id: 'glue' } },
                      { id: 'ex-dl4', type: 'serviceNode', position: { x: 550, y: 220 }, data: { name: 'Amazon Athena', price: 5.00, id: 'athena' } }
                    ]);
                    setEdges([
                      { id: 'e-dl-1', source: 'ex-dl1', target: 'ex-dl2' },
                      { id: 'e-dl-2', source: 'ex-dl2', target: 'ex-dl3', animated: true },
                      { id: 'e-dl-3', source: 'ex-dl2', target: 'ex-dl4' }
                    ]);
                 }}
             >
                 <h4 className="font-semibold text-indigo-400 mb-1 group-hover:text-indigo-300">Modern Data Lake</h4>
                 <p className="text-xs text-gray-400 leading-relaxed">Stream data ingestion to S3, with Glue for cataloging and Athena for querying.</p>
             </button>
         </div>
      </div>

      {/* CENTER CANVAS */}
      <div className="flex-1 flex flex-col relative w-full h-full">
        <header className="h-[70px] border-b border-gray-800 bg-gray-900/50 backdrop-blur pl-6 pr-6 flex items-center justify-between shrink-0">
           <div className="flex items-center gap-4">
              <span className="font-bold text-lg text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-indigo-400">AWS Cost Estimator</span>
              <select 
                value={region} 
                onChange={(e) => setRegion(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-md text-sm px-3 py-1 ml-4 outline-none"
              >
                <option value="US East (N. Virginia)">US East (N. Virginia)</option>
                <option value="Europe (Ireland)">Europe (Ireland)</option>
              </select>
           </div>
           <div className="text-right">
              <div className="text-xs text-gray-400 font-medium">Est. Total Monthly</div>
              <div className="text-2xl font-bold text-indigo-400 leading-none">${calculateTotal()}</div>
           </div>
        </header>

        <main className="flex-1 relative w-full h-full" ref={reactFlowWrapper}>
           <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onDrop={onDrop}
              onDragOver={onDragOver}
              nodeTypes={nodeTypes}
              fitView
            >
              <Background color="#555" gap={20} size={1} />
              <Controls className="bg-gray-800 fill-white border-0" />
           </ReactFlow>
        </main>
      </div>

      {/* RIGHT PALETTE SIDEBAR */}
      <aside className="w-[200px] bg-gray-900 border-l border-gray-800 px-4 py-6 z-10 flex flex-col gap-6 shrink-0 shadow-lg overflow-y-auto">
         {categories.length === 0 ? (
            <div className="text-gray-500 text-xs italic">Loading services...</div>
         ) : (
            categories.map(category => (
               <div key={category.category}>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">{category.category}</h3>
                  {category.services.map(service => (
                     <div 
                        key={service.id}
                        onDragStart={(e) => onDragStart(e, { id: service.id, name: service.name, price: service.price })} 
                        draggable 
                        className="bg-gray-800 border border-gray-700 p-3 rounded cursor-grab hover:bg-gray-700 hover:border-indigo-500 transition flex flex-col mb-2 text-sm shadow-sm"
                     >
                        {service.name} <span className="text-xs text-indigo-400 font-mono mt-1">${service.price.toFixed(2)}/mo</span>
                     </div>
                  ))}
               </div>
            ))
         )}
      </aside>

    </div>
  );
}
