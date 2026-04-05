"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  ReactFlow, Controls, Background, addEdge, 
  useNodesState, useEdgesState, Handle, Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { LayoutGrid, Wand2, BookOpen, Info, ShieldCheck, Zap } from 'lucide-react';
import { getAwsServicesCatalog, AwsServiceCat } from '../actions/awsPricing';
import { calculateServicePrice } from '../lib/pricing-calculators';
import NodeInspector from '../components/NodeInspector';

// --- CUSTOM NODE ---
const ServiceNode = ({ data, selected }: any) => {
  // Default capacity if not set
  const maxRps = data.config?.maxRps || (data.id === 'ec2' ? 500 : 1000);

  return (
    <div className={`bg-gray-900 border ${selected ? 'border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]' : 'border-gray-700'} rounded-lg p-3 w-48 shadow-xl text-white transition-all relative group`}>
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-gray-500" />
      
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-indigo-600 flex items-center justify-center">
            {data.id === 'ec2' ? <ShieldCheck size={14} /> : <Zap size={14} />}
          </div>
          <span className="font-semibold text-sm truncate max-w-[90px]">{data.name}</span>
        </div>
        
        <div className="relative group/tooltip">
          <div className="bg-indigo-500/20 text-indigo-300 text-[9px] px-1.5 py-0.5 rounded border border-indigo-500/30 cursor-help flex items-center gap-1 font-mono uppercase tracking-tighter shrink-0">
            {maxRps} RPS
          </div>
          
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 p-2 bg-gray-800 border border-gray-700 rounded text-[9px] text-gray-300 opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity z-50 shadow-2xl">
            Capacity: {maxRps} Req/Sec per Instance. System auto-scales if global traffic exceeds this.
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-800"></div>
          </div>
        </div>
      </div>

      <div className="text-[10px] text-gray-500 mb-1">
        {data.config?.instances > 1 ? `${data.config.instances}x Instances Running` : 'Single Instance'}
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
  const [globalRps, setGlobalRps] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
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

  useEffect(() => {
    setNodes((currentNodes) => {
       if (currentNodes.length === 0) return currentNodes;
       return currentNodes.map(node => {
          const dynamicPrice = calculateServicePrice(node.data.id, node.data.basePrice, node.data.config, { rps: globalRps });
          return { ...node, data: { ...node.data, price: dynamicPrice } };
       });
    });
  }, [globalRps, setNodes]);

  const selectedNode = nodes.find((n: any) => n.selected);

  const updateNodeConfig = (id: string, newConfig: any) => {
    setNodes(currentNodes => currentNodes.map(node => {
      if (node.id === id) {
         const mergedConfig = { ...node.data.config, ...newConfig };
         const dynamicPrice = calculateServicePrice(node.data.id, node.data.basePrice, mergedConfig, { rps: globalRps });
         return {
            ...node,
            data: { ...node.data, config: mergedConfig, price: dynamicPrice }
         };
      }
      return node;
    }));
  };

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

      const defaultMaxRps = parsedData.id === 'ec2' ? 500 : 1000;

      const newNode = {
        id: `node-${Date.now()}`,
        type: 'serviceNode',
        position,
        data: { 
          name: parsedData.name, 
          price: parsedData.price, 
          basePrice: parsedData.price, 
          id: parsedData.id, 
          config: { instances: 1, maxRps: defaultMaxRps } 
        },
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

  const calculateTotalCapacity = () => {
    // Current system capacity is governed by the bottleneck (minimum capacity in the chain)
    if (nodes.length === 0) return 0;
    const capacities = nodes
      .filter((n: any) => n.data.id === 'ec2' || n.data.id === 'lambda' || n.data.id === 'fargate' || n.data.config?.maxRps)
      .map((n: any) => (n.data.config?.maxRps || (n.data.id === 'ec2' ? 500 : 1000)) * (n.data.config?.instances || 1));
    
    if (capacities.length === 0) return 0;
    return Math.min(...capacities); 
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
              setNodes([
                { id: 'gen1', type: 'serviceNode', position: { x: 50, y: 150 }, data: { name: 'Amazon CloudFront', price: 8.50, basePrice: 8.50, id: 'cloudfront', config: { instances: 1, maxRps: 1000 } } },
                { id: 'gen2', type: 'serviceNode', position: { x: 300, y: 150 }, data: { name: 'Amazon EC2', price: 25.40, basePrice: 25.40, id: 'ec2', config: { instances: 1, maxRps: 500 } } },
                { id: 'gen3', type: 'serviceNode', position: { x: 550, y: 150 }, data: { name: 'Amazon RDS', price: 15.20, basePrice: 15.20, id: 'rds', config: { instances: 1 } } }
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
             {/* Original Architecture Examples replaced here by buttons */}
             <button 
                 className="text-left bg-gray-800 border border-gray-700 p-4 rounded-lg hover:border-indigo-500 hover:bg-gray-800/80 transition-all group"
                 onClick={() => {
                    setActiveLeftPanel('none');
                    setNodes([
                      { id: 'ex-web1', type: 'serviceNode', position: { x: 50, y: 100 }, data: { name: 'Amazon CloudFront', price: 8.50, basePrice: 8.50, id: 'cloudfront', config: { instances: 1, maxRps: 1000 } } },
                      { id: 'ex-web2', type: 'serviceNode', position: { x: 300, y: 50 }, data: { name: 'Amazon S3', price: 5.00, basePrice: 5.00, id: 's3', config: { instances: 1 } } },
                      { id: 'ex-web3', type: 'serviceNode', position: { x: 300, y: 200 }, data: { name: 'Amazon EC2', price: 25.40, basePrice: 25.40, id: 'ec2', config: { instances: 1, instanceType: 't3.micro', maxRps: 500 } } },
                      { id: 'ex-web4', type: 'serviceNode', position: { x: 550, y: 200 }, data: { name: 'Amazon RDS', price: 15.20, basePrice: 15.20, id: 'rds', config: { instances: 1, instanceClass: 'db.t3.micro' } } }
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
                      { id: 'ex-srv1', type: 'serviceNode', position: { x: 50, y: 150 }, data: { name: 'Amazon API Gateway', price: 3.50, basePrice: 3.50, id: 'apigateway', config: { instances: 1, maxRps: 2000 } } },
                      { id: 'ex-srv2', type: 'serviceNode', position: { x: 300, y: 150 }, data: { name: 'AWS Lambda', price: 2.00, basePrice: 2.00, id: 'lambda', config: { instances: 1, invocations1M: 1, memoryMB: 512, maxRps: 1000 } } },
                      { id: 'ex-srv3', type: 'serviceNode', position: { x: 550, y: 150 }, data: { name: 'Amazon DynamoDB', price: 1.25, basePrice: 1.25, id: 'dynamodb', config: { instances: 1 } } }
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
                      { id: 'ex-dl1', type: 'serviceNode', position: { x: 50, y: 150 }, data: { name: 'Amazon Kinesis', price: 15.00, basePrice: 15.00, id: 'kinesis', config: { instances: 1, maxRps: 5000 } } },
                      { id: 'ex-dl2', type: 'serviceNode', position: { x: 300, y: 150 }, data: { name: 'Amazon S3', price: 5.00, basePrice: 5.00, id: 's3', config: { instances: 1, storageGB: 100 } } },
                      { id: 'ex-dl3', type: 'serviceNode', position: { x: 550, y: 80 }, data: { name: 'AWS Glue', price: 12.00, basePrice: 12.00, id: 'glue', config: { instances: 1 } } },
                      { id: 'ex-dl4', type: 'serviceNode', position: { x: 550, y: 220 }, data: { name: 'Amazon Athena', price: 5.00, basePrice: 5.00, id: 'athena', config: { instances: 1 } } }
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

             <button 
                 className="text-left bg-gray-800 border border-gray-700 p-4 rounded-lg hover:border-indigo-500 hover:bg-gray-800/80 transition-all group relative overflow-hidden"
                 onClick={() => {
                    setActiveLeftPanel('none');
                    setNodes([
                      { id: 'tf-s1', type: 'serviceNode', position: { x: 50, y: 150 }, data: { name: 'Application Load Balancer', price: 16.50, basePrice: 16.50, id: 'alb', config: { instances: 1, maxRps: 2000 } } },
                      { id: 'tf-s2', type: 'serviceNode', position: { x: 300, y: 50 }, data: { name: 'Amazon CloudFront', price: 8.50, basePrice: 8.50, id: 'cloudfront', config: { instances: 1, maxRps: 5000 } } },
                      { id: 'tf-s3', type: 'serviceNode', position: { x: 300, y: 150 }, data: { name: 'AWS Fargate', price: 12.00, basePrice: 12.00, id: 'fargate', config: { instances: 2, maxRps: 500 } } },
                      { id: 'tf-s4', type: 'serviceNode', position: { x: 550, y: 80 }, data: { name: 'Amazon EFS', price: 5.00, basePrice: 5.00, id: 'efs', config: { instances: 1 } } },
                      { id: 'tf-s5', type: 'serviceNode', position: { x: 550, y: 220 }, data: { name: 'Amazon RDS', price: 15.20, basePrice: 15.20, id: 'rds', config: { instances: 1, instanceClass: 'db.t3.medium' } } }
                    ]);
                    setEdges([
                      { id: 'tf-e1', source: 'tf-s1', target: 'tf-s3', animated: true },
                      { id: 'tf-e2', source: 'tf-s2', target: 'tf-s1' },
                      { id: 'tf-e3', source: 'tf-s3', target: 'tf-s4' },
                      { id: 'tf-e4', source: 'tf-s3', target: 'tf-s5' }
                    ]);
                 }}
             >
                 <div className="absolute top-0 right-0 bg-indigo-600 text-xs px-2 py-0.5 rounded-bl-lg font-mono text-white shadow">Local IaC</div>
                 <h4 className="font-semibold text-indigo-400 mb-1 group-hover:text-indigo-300 mt-2">Import: infra/aws/wordpress_fargate</h4>
                 <p className="text-xs text-gray-400 leading-relaxed mb-3">Reads your ALB, CloudFront, EFS, Fargate, and RDS configuration.</p>
                 <div className="bg-black/50 p-2 rounded text-[10px] font-mono text-gray-500 line-clamp-3">
                   {`resource "aws_ecs_service" "wordpress" {
  name = "wordpress-service"
  launch_type = "FARGATE"
}`}
                 </div>
             </button>

             <button 
                 className="text-left bg-gray-800 border border-gray-700 p-4 rounded-lg hover:border-indigo-500 hover:bg-gray-800/80 transition-all group relative overflow-hidden"
                 onClick={() => {
                    setActiveLeftPanel('none');
                    setNodes([
                      { id: 'tf-m1', type: 'serviceNode', position: { x: 50, y: 150 }, data: { name: 'Amazon Route 53', price: 0.50, basePrice: 0.50, id: 'route53', config: { instances: 1 } } },
                      { id: 'tf-m2', type: 'serviceNode', position: { x: 300, y: 150 }, data: { name: 'Amazon API Gateway', price: 3.50, basePrice: 3.50, id: 'apigateway', config: { instances: 1, maxRps: 2000 } } },
                      { id: 'tf-m3', type: 'serviceNode', position: { x: 550, y: 150 }, data: { name: 'AWS Lambda', price: 2.00, basePrice: 2.00, id: 'lambda', config: { instances: 1, memoryMB: 1024, maxRps: 1000 } } }
                    ]);
                    setEdges([
                      { id: 'tfe-1', source: 'tf-m1', target: 'tf-m2' },
                      { id: 'tfe-2', source: 'tf-m2', target: 'tf-m3', animated: true }
                    ]);
                 }}
             >
                 <div className="absolute top-0 right-0 bg-indigo-600 text-xs px-2 py-0.5 rounded-bl-lg font-mono text-white shadow">Local IaC</div>
                 <h4 className="font-semibold text-indigo-400 mb-1 group-hover:text-indigo-300 mt-2">Import: infra/aws/aws_lambda_api</h4>
                 <p className="text-xs text-gray-400 leading-relaxed mb-3">Imports your custom API Gateway and Lambda backend project.</p>
                 <div className="bg-black/50 p-2 rounded text-[10px] font-mono text-gray-500 line-clamp-3">
                   {`resource "aws_lambda_function" "api" {
  function_name = "production-api"
  runtime = "nodejs18.x"
}`}
                 </div>
             </button>
         </div>
      </div>

      {/* CENTER CANVAS */}
      <div className="flex-1 flex flex-col relative w-full h-full">
        <header className="h-[70px] border-b border-gray-800 bg-gray-900/50 backdrop-blur pl-6 pr-6 flex items-center justify-between shrink-0">
           <div className="flex items-center gap-4">
              <span className="font-bold text-lg text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-indigo-400">AWS Cost Estimator</span>
              
              <div className="flex flex-col ml-4">
                 <div className="flex items-center bg-gray-800 border border-gray-700 rounded-md">
                    <span className="pl-3 pr-2 text-xs text-gray-400">Site Traffic (RPS):</span>
                    <input 
                       type="number" 
                       min="1"
                       value={globalRps}
                       onChange={(e) => setGlobalRps(parseInt(e.target.value) || 1)}
                       className="bg-transparent text-sm text-white px-2 py-1 outline-none w-20 text-right"
                    />
                 </div>
                 <div className="text-[10px] text-indigo-400/70 mt-1 text-right font-mono tracking-tight">
                    ~{(globalRps * 86400).toLocaleString()} reqs / day
                 </div>
              </div>

              <select 
                value={region} 
                onChange={(e) => setRegion(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-md text-sm px-3 py-1 ml-4 outline-none"
              >
                <option value="US East (N. Virginia)">US East (N. Virginia)</option>
                <option value="Europe (Ireland)">Europe (Ireland)</option>
              </select>
           </div>
           <div className="flex items-center gap-8 text-right font-sans">
               <div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Architecture Capacity</div>
                  <div className="text-xl font-bold text-gray-200 leading-none">
                     {calculateTotalCapacity().toLocaleString()} <span className="text-[10px] text-gray-500 font-normal ml-0.5 uppercase">RPS</span>
                  </div>
               </div>
               <div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Est. Total Monthly</div>
                  <div className="text-2xl font-bold text-indigo-400 leading-none">${calculateTotal()}</div>
               </div>
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
      <aside className="w-[300px] bg-gray-900 border-l border-gray-800 px-4 py-6 z-10 flex flex-col gap-6 shrink-0 shadow-lg overflow-y-auto transition-all">
         {selectedNode ? (
            <NodeInspector node={selectedNode} onChange={updateNodeConfig} />
         ) : categories.length === 0 ? (
            <div className="text-gray-500 text-xs italic">Loading services...</div>
         ) : (
            <>
              <h2 className="text-xl font-bold mb-1 border-b border-gray-800 pb-2 text-white">Service Catalog</h2>
              <input 
                 type="text" 
                 placeholder="Search services..." 
                 value={searchQuery}
                 onChange={e => setSearchQuery(e.target.value)}
                 className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white outline-none focus:border-indigo-500 transition-colors"
              />
              {categories.map(category => {
                 const filteredServices = category.services.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
                 if (filteredServices.length === 0) return null;
                 return (
                  <div key={category.category}>
                     <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">{category.category}</h3>
                     {filteredServices.map(service => {
                        const defaultRps = service.id === 'ec2' ? 500 : 1000;
                        return (
                          <div 
                             key={service.id}
                             onDragStart={(e) => onDragStart(e, { id: service.id, name: service.name, price: service.price })} 
                             draggable 
                             className="bg-gray-800 border border-gray-700 p-3 rounded cursor-grab hover:bg-gray-700 hover:border-indigo-500 transition flex flex-col mb-2 text-sm shadow-sm group"
                          >
                             <div className="flex justify-between items-start">
                                <span className="font-medium">{service.name}</span>
                                <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1 rounded font-mono">
                                  {defaultRps} RPS
                                </span>
                             </div>
                             <span className="text-xs text-gray-400 font-mono mt-1">${service.price.toFixed(2)}/mo</span>
                          </div>
                        );
                     })}
                  </div>
                 )
              })}
            </>
         )}
      </aside>

    </div>
  );
}
