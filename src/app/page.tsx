"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  ReactFlow, Controls, Background, addEdge, MiniMap,
  useNodesState, useEdgesState, Handle, Position, BackgroundVariant, ConnectionMode,
  EdgeProps, EdgeLabelRenderer, BaseEdge, getBezierPath, useReactFlow, reconnectEdge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { LayoutGrid, Wand2, BookOpen, Info, ShieldCheck, Zap, Upload, Server, Database, Cloud, Globe, Lock, BarChart2, GitMerge, Box, HardDrive } from 'lucide-react';
import { getAwsServicesCatalog, AwsServiceCat } from '../actions/awsPricing';
import { calculateServicePrice } from '../lib/pricing-calculators';
import { processTerraformFiles } from '../actions/terraformImport';
import { listInfraExamples, loadInfraExample, InfraExample } from '../actions/infraExamples';
import NodeInspector from '../components/NodeInspector';

// --- SERVICE ICON & COLOR MAP ---
const SERVICE_STYLES: Record<string, { icon: any; color: string; glow: string; label: string }> = {
  ec2:         { icon: Server,     color: '#f97316',  glow: 'rgba(249,115,22,0.35)',   label: 'EC2' },
  lambda:      { icon: Zap,        color: '#a855f7',  glow: 'rgba(168,85,247,0.35)',   label: 'Lambda' },
  rds:         { icon: Database,   color: '#3b82f6',  glow: 'rgba(59,130,246,0.35)',   label: 'RDS' },
  s3:          { icon: HardDrive,  color: '#22c55e',  glow: 'rgba(34,197,94,0.35)',    label: 'S3' },
  alb:         { icon: GitMerge,   color: '#14b8a6',  glow: 'rgba(20,184,166,0.35)',   label: 'ALB' },
  fargate:     { icon: Box,        color: '#ec4899',  glow: 'rgba(236,72,153,0.35)',   label: 'Fargate' },
  eks:         { icon: Server,     color: '#f59e0b',  glow: 'rgba(245,158,11,0.35)',   label: 'EKS' },
  dynamodb:    { icon: Database,   color: '#6366f1',  glow: 'rgba(99,102,241,0.35)',   label: 'DynamoDB' },
  cloudfront:  { icon: Globe,      color: '#06b6d4',  glow: 'rgba(6,182,212,0.35)',    label: 'CloudFront' },
  cognito:     { icon: Lock,       color: '#d946ef',  glow: 'rgba(217,70,239,0.35)',   label: 'Cognito' },
  sqs:         { icon: GitMerge,   color: '#f59e0b',  glow: 'rgba(245,158,11,0.35)',   label: 'SQS' },
  sns:         { icon: GitMerge,   color: '#ef4444',  glow: 'rgba(239,68,68,0.35)',    label: 'SNS' },
  kinesis:     { icon: BarChart2,  color: '#8b5cf6',  glow: 'rgba(139,92,246,0.35)',   label: 'Kinesis' },
  msk:         { icon: GitMerge,   color: '#d97706',  glow: 'rgba(217,119,6,0.35)',    label: 'MSK' },
  elasticache: { icon: Database,   color: '#10b981',  glow: 'rgba(16,185,129,0.35)',   label: 'ElastiCache' },
  vpc:         { icon: Cloud,      color: '#64748b',  glow: 'rgba(100,116,139,0.35)',  label: 'VPC' },
  apigateway:  { icon: Globe,      color: '#0ea5e9',  glow: 'rgba(14,165,233,0.35)',   label: 'API GW' },
  route53:     { icon: Globe,      color: '#84cc16',  glow: 'rgba(132,204,22,0.35)',   label: 'Route53' },
  efs:         { icon: HardDrive,  color: '#f97316',  glow: 'rgba(249,115,22,0.35)',   label: 'EFS' },
  glue:        { icon: GitMerge,   color: '#a78bfa',  glow: 'rgba(167,139,250,0.35)',  label: 'Glue' },
  athena:      { icon: BarChart2,  color: '#2dd4bf',  glow: 'rgba(45,212,191,0.35)',   label: 'Athena' },
};
const DEFAULT_STYLE = { icon: Cloud, color: '#6366f1', glow: 'rgba(99,102,241,0.35)', label: 'AWS' };

// --- PREMIUM SERVICE NODE ---
const ServiceNode = ({ data, selected }: any) => {
  const maxRps = data.config?.maxRps || (data.id === 'ec2' ? 500 : 1000);
  const style = SERVICE_STYLES[data.id] || DEFAULT_STYLE;
  const Icon = style.icon;
  const isAtCapacity = maxRps <= data.config?.globalRps;
  const action = data.action as { label: string; color: string } | undefined;

  return (
    <div 
      className="relative group"
      style={{ 
        filter: selected ? `drop-shadow(0 0 12px ${style.glow})` : 'none',
        transition: 'filter 0.2s ease'
      }}
    >
      <Handle type="target" id="target-left" position={Position.Left} style={{ background: style.color, width: 10, height: 10, border: '2px solid #111', zIndex: 10 }} />
      <Handle type="source" id="source-left" position={Position.Left} style={{ background: 'transparent', width: 10, height: 10, border: 'none', zIndex: 11 }} />
      
      <div 
        className="rounded-xl p-0.5 transition-all duration-200"
        style={{ 
          background: selected 
            ? `linear-gradient(135deg, ${style.color}60, ${style.color}20)` 
            : 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
          boxShadow: selected ? `0 0 20px ${style.glow}, inset 0 0 20px rgba(0,0,0,0.5)` : '0 4px 24px rgba(0,0,0,0.4)'
        }}
      >
        <div 
          className="rounded-[10px] px-3 py-2.5 w-52 text-white"
          style={{ background: 'rgba(10, 12, 20, 0.92)', backdropFilter: 'blur(12px)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div 
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${style.color}25`, border: `1px solid ${style.color}50` }}
              >
                <Icon size={14} style={{ color: style.color }} />
              </div>
              <div>
                <div className="font-semibold text-[11px] leading-tight text-white">{data.name}</div>
                <div className="text-[9px] text-gray-500 uppercase tracking-widest">{style.label}</div>
              </div>
            </div>
            
            {/* RPS Capacity Badge */}
            <div className="relative group/tooltip">
              <div 
                className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold cursor-help"
                style={{ 
                  color: isAtCapacity ? '#ef4444' : style.color,
                  background: isAtCapacity ? 'rgba(239,68,68,0.1)' : `${style.color}15`,
                  border: `1px solid ${isAtCapacity ? 'rgba(239,68,68,0.3)' : `${style.color}30`}`
                }}
              >
                {maxRps} RPS
              </div>
              <div className="absolute bottom-full right-0 mb-2 w-40 p-2 bg-gray-900 border border-gray-700 rounded-lg text-[9px] text-gray-300 opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity z-50 shadow-2xl">
                Max Capacity: {maxRps.toLocaleString()} req/sec per instance
                <div className="absolute top-full right-2 border-4 border-transparent border-t-gray-700"></div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px w-full mb-2" style={{ background: `linear-gradient(90deg, ${style.color}40, transparent)` }} />

          {/* Plan Action Badge (only shown when imported from terraform plan) */}
          {action && (
            <div className="mb-1.5">
              <span 
                className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                style={{ color: action.color, background: `${action.color}15`, border: `1px solid ${action.color}30` }}
              >
                {action.label}
              </span>
            </div>
          )}

          {/* Instance Info */}
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-gray-500">
              {data.config?.instances > 1 ? `${data.config.instances}× instances` : '1× instance'}
            </span>
            <span 
              className="text-sm font-bold font-mono"
              style={{ color: style.color }}
            >
              ${data.price.toFixed(2)}<span className="text-[8px] font-normal text-gray-600">/mo</span>
            </span>
          </div>
        </div>
      </div>

      <Handle type="source" id="source-right" position={Position.Right} style={{ background: style.color, width: 10, height: 10, border: '2px solid #111', zIndex: 10 }} />
      <Handle type="target" id="target-right" position={Position.Right} style={{ background: 'transparent', width: 10, height: 10, border: 'none', zIndex: 11 }} />
    </div>
  );
};

// --- GROUP NODE (VPC / AZ / Subnet Container) ---
const GroupNode = ({ data, selected }: any) => {
  const colors: Record<string, { border: string; bg: string; label: string }> = {
    vpc:    { border: '#22c55e', bg: 'rgba(34,197,94,0.04)',   label: 'VPC' },
    region: { border: '#3b82f6', bg: 'rgba(59,130,246,0.04)',  label: 'Region' },
    az:     { border: '#6366f1', bg: 'rgba(99,102,241,0.04)',  label: 'Availability Zone' },
    subnet: { border: '#64748b', bg: 'rgba(100,116,139,0.06)', label: 'Subnet' },
  };
  const c = colors[data.groupType] || colors.vpc;
  
  return (
    <div 
      className="rounded-xl"
      style={{ 
        width: data.width || 400,
        height: data.height || 250,
        border: `1.5px dashed ${c.border}40`,
        background: c.bg,
        backdropFilter: 'blur(2px)',
        boxShadow: selected ? `0 0 0 1.5px ${c.border}60` : 'none'
      }}
    >
      <div 
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-br-lg rounded-tl-[10px] text-[10px] font-bold uppercase tracking-widest"
        style={{ background: `${c.border}20`, color: c.border, borderBottom: `1px solid ${c.border}30`, borderRight: `1px solid ${c.border}30` }}
      >
        <Cloud size={9} />
        {c.label}: <span className="font-mono normal-case tracking-normal font-normal ml-1 opacity-70">{data.label}</span>
      </div>
    </div>
  );
};

const nodeTypes = { serviceNode: ServiceNode, groupNode: GroupNode };

const CustomEdge = (props: EdgeProps) => {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, source, target, selected } = props;
  const { setEdges, getEdges } = useReactFlow();
  const [isHovered, setIsHovered] = useState(false);
  
  const edges = getEdges();
  const parallelEdges = edges.filter(e => 
    (e.source === source && e.target === target) ||
    (e.source === target && e.target === source)
  );
  
  const sortedParallel = [...parallelEdges].sort((a,b) => a.id.localeCompare(b.id));
  const edgeIndex = sortedParallel.findIndex(e => e.id === id);
  const baseCurvature = 0.25;
  const curvature = baseCurvature + (edgeIndex * 0.2);
  
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, curvature
  });

  const showIcon = selected || isHovered;

  return (
    <g onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={{
         ...style, 
         stroke: selected ? '#818cf8' : style?.stroke || '#6366f1',
         strokeWidth: selected ? 2.5 : style?.strokeWidth || 1.5
      }} />
      <EdgeLabelRenderer>
        <div style={{
          position: 'absolute',
          transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          pointerEvents: showIcon ? 'all' : 'none',
          opacity: showIcon ? 1 : 0,
          transition: 'opacity 0.2s',
          zIndex: 1000
        }}>
          <button 
             onClick={(e) => { e.stopPropagation(); setEdges(edges => edges.filter(ed => ed.id !== id)); }}
             onMouseEnter={() => setIsHovered(true)}
             onMouseLeave={() => setIsHovered(false)}
             className="rounded-full w-5 h-5 flex items-center justify-center cursor-pointer"
             style={{ background: '#ef4444', color: 'white', border: '1px solid #7f1d1d', fontSize: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}
             title="Delete Connection"
          >
            ✕
          </button>
        </div>
      </EdgeLabelRenderer>
    </g>
  );
};

const edgeTypes = { customEdge: CustomEdge };

// Animated Edge style
const defaultEdgeOptions: any = {
  type: 'customEdge',
  animated: true,
  style: { stroke: '#6366f1', strokeWidth: 1.5, strokeDasharray: '6 3' },
};

// --- MAIN PAGE ---
export default function CostEstimatorApp() {
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  const [activeLeftPanel, setActiveLeftPanel] = useState<'none' | 'wizard' | 'examples' | 'import'>('none');
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<null | { total: number; created: number; updated: number; noChange: number; source: string }>(null);
  const [loadingExampleId, setLoadingExampleId] = useState<string | null>(null);
  const [infraExamples, setInfraExamples] = useState<InfraExample[]>([]);
  const [categories, setCategories] = useState<AwsServiceCat[]>([]);
  const [region, setRegion] = useState("US East (N. Virginia)");
  const [globalRps, setGlobalRps] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Load example metadata on mount
  useEffect(() => { listInfraExamples().then(setInfraExamples); }, []);

  useEffect(() => {
    getAwsServicesCatalog(region).then(data => {
       setCategories(data);
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
    (params: any) => setEdges((eds) => addEdge({ type: 'customEdge', ...params, animated: true, style: { stroke: '#6366f1', strokeWidth: 1.5 } }, eds)),
    [setEdges],
  );

  const onReconnect = useCallback(
    (oldEdge: any, newConnection: any) => setEdges((els) => reconnectEdge(oldEdge, newConnection, els)),
    [setEdges]
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
      if (typeof serviceData === 'undefined' || !serviceData || !reactFlowBounds) return;
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

  const calculateTotal = () => nodes.reduce((sum, n) => sum + (n.data.price || 0), 0).toFixed(2);

  const calculateTotalCapacity = () => {
    if (nodes.length === 0) return 0;
    const capacities = nodes
      .filter((n: any) => n.data.id === 'ec2' || n.data.id === 'lambda' || n.data.id === 'fargate' || n.data.config?.maxRps)
      .map((n: any) => (n.data.config?.maxRps || (n.data.id === 'ec2' ? 500 : 1000)) * (n.data.config?.instances || 1));
    if (capacities.length === 0) return 0;
    return Math.min(...capacities); 
  };

  const capacityPct = globalRps > 0 && calculateTotalCapacity() > 0 
    ? Math.min(100, (globalRps / calculateTotalCapacity()) * 100) 
    : 0;
  const capacityColor = capacityPct > 85 ? '#ef4444' : capacityPct > 60 ? '#f59e0b' : '#22c55e';

  return (
    <div className="flex h-screen w-screen overflow-hidden font-sans" style={{ background: '#060810', color: 'white' }}>
      
      {/* LEFT NAVIGATION */}
      <nav className="w-[60px] border-r flex flex-col items-center py-6 gap-5 z-10 shrink-0" style={{ background: 'rgba(5,7,15,0.95)', borderColor: 'rgba(255,255,255,0.06)' }}>
        {[
          { id: 'none',     icon: LayoutGrid, title: 'Canvas' },
          { id: 'wizard',   icon: Wand2,      title: 'Smart Wizard' },
          { id: 'examples', icon: BookOpen,   title: 'Examples' },
          { id: 'import',   icon: Upload,     title: 'Import Terraform' },
        ].map(({ id, icon: Icon, title }) => (
          <button 
            key={id}
            title={title}
            onClick={() => setActiveLeftPanel(activeLeftPanel === id ? 'none' : id as any)}
            className="relative p-2.5 rounded-xl transition-all duration-200"
            style={{ 
              background: activeLeftPanel === id ? 'rgba(99,102,241,0.15)' : 'transparent',
              color: activeLeftPanel === id ? '#818cf8' : 'rgba(255,255,255,0.3)',
              boxShadow: activeLeftPanel === id ? '0 0 12px rgba(99,102,241,0.2)' : 'none',
            }}
          >
            <Icon size={20} />
            {activeLeftPanel === id && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r" style={{ background: '#818cf8', boxShadow: '0 0 8px rgba(129,140,248,0.8)' }} />
            )}
          </button>
        ))}
      </nav>

      {/* WIZARD SIDEBAR */}
      <div className={`absolute top-[70px] left-[60px] bottom-0 w-[400px] border-r flex flex-col gap-5 transition-all duration-300 z-20 overflow-y-auto px-5 py-6 ${activeLeftPanel === 'wizard' ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none'}`} style={{ background: 'rgba(7,9,18,0.97)', borderColor: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)' }}>
         <div className="border-b pb-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
           <h2 className="text-lg font-bold text-white">Smart Intake Wizard</h2>
           <p className="text-gray-500 text-xs mt-1">Answer a few questions to generate a starter architecture.</p>
         </div>
         <div className="text-gray-600 text-sm italic mt-4">🚧 Wizard coming soon...</div>
      </div>

      {/* EXAMPLES SIDEBAR — powered by .tfplan.json files */}
      <div className={`absolute top-[70px] left-[60px] bottom-0 w-[420px] border-r transition-all duration-300 z-20 overflow-y-auto px-5 py-6 ${activeLeftPanel === 'examples' ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none'}`} style={{ background: 'rgba(7,9,18,0.97)', borderColor: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)' }}>
         <div className="border-b pb-3 mb-2" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
           <h2 className="text-lg font-bold text-white">Architecture Examples</h2>
           <p className="text-gray-500 text-xs mt-1">Loaded from real Terraform plan files. Click to apply to canvas.</p>
         </div>

         {/* Format badge */}
         <div className="flex items-center gap-1.5 mb-5 pt-1">
           <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
             JSON Plan
           </span>
           <span className="text-[9px] text-gray-600">terraform show -json · parsed in browser</span>
         </div>

         {infraExamples.length === 0 ? (
           <div className="flex flex-col gap-3">
             {[1,2,3,4].map(i => (
               <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />
             ))}
           </div>
         ) : infraExamples.map(ex => (
           <div key={ex.id}
             className="w-full mb-3 rounded-xl border transition-all duration-200 overflow-hidden"
             style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}
             onMouseEnter={e => (e.currentTarget.style.borderColor = `${ex.tagColor}40`)}
             onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}
           >
             <div className="p-4">
               <div className="flex items-center gap-2 mb-2">
                 <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${ex.tagColor}18`, color: ex.tagColor, border: `1px solid ${ex.tagColor}30` }}>{ex.tag}</span>
                 <span className="font-semibold text-sm text-white">{ex.title}</span>
               </div>
               <p className="text-gray-500 text-xs mb-3 leading-relaxed">{ex.description}</p>
               
               {/* Service pills */}
               <div className="flex flex-wrap gap-1 mb-3">
                 {ex.services.map(sId => {
                   const s = SERVICE_STYLES[sId];
                   if (!s) return null;
                   const Icon = s.icon;
                   return (
                     <span key={sId} className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded" style={{ background: `${s.color}12`, color: s.color, border: `1px solid ${s.color}20` }}>
                       <Icon size={8} /> {s.label}
                     </span>
                   );
                 })}
               </div>
             </div>

             <button
               className="w-full py-2.5 text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-2"
               style={{ background: loadingExampleId === ex.id ? `${ex.tagColor}25` : `${ex.tagColor}10`, color: ex.tagColor, borderTop: `1px solid ${ex.tagColor}20` }}
               disabled={loadingExampleId !== null}
               onClick={async () => {
                 setLoadingExampleId(ex.id);
                 try {
                   const result = await loadInfraExample(ex.id);
                   setNodes(result.nodes);
                   setEdges(result.edges);
                   setImportSummary(result.summary);
                   setActiveLeftPanel('none');
                 } catch (err) {
                   alert(`Failed to load example: ${ex.title}`);
                 } finally {
                   setLoadingExampleId(null);
                 }
               }}
             >
               {loadingExampleId === ex.id ? (
                 <><div className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: ex.tagColor, borderTopColor: 'transparent' }} /> Parsing plan...</>
               ) : (
                 <> Load onto Canvas →</>
               )}
             </button>
           </div>
         ))}
      </div>

      {/* IMPORT SIDEBAR */}
      <div className={`absolute top-[70px] left-[60px] bottom-0 w-[420px] border-r transition-all duration-300 z-20 overflow-y-auto px-5 py-6 ${activeLeftPanel === 'import' ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none'}`} style={{ background: 'rgba(7,9,18,0.97)', borderColor: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)' }}>
         <div className="flex items-center gap-2 mb-1 border-b pb-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <h2 className="text-lg font-bold text-white">Import Infrastructure</h2>
         </div>

         {/* FORMAT GUIDE */}
         <div className="mt-3 mb-5 grid grid-cols-1 gap-2">
           {[
             { label: 'terraform show -json', badge: 'JSON Plan', color: '#22c55e', desc: 'Most accurate — exports after/before state per resource.' },
             { label: 'terraform plan (stdout)', badge: 'Text Plan', color: '#f59e0b', desc: 'Paste or upload the plan text output.' },
             { label: '*.tf source files', badge: 'HCL Files', color: '#818cf8', desc: 'Upload a folder of raw Terraform config files.' },
           ].map(f => (
             <div key={f.badge} className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
               <div className="flex items-center gap-2 mb-0.5">
                 <span className="text-[9px] font-bold px-1.5 py-0.5 rounded font-mono" style={{ background: `${f.color}18`, color: f.color, border: `1px solid ${f.color}30` }}>{f.badge}</span>
                 <code className="text-[9px] text-gray-600">{f.label}</code>
               </div>
               <p className="text-[10px] text-gray-600">{f.desc}</p>
             </div>
           ))}
         </div>

         {/* DROP ZONE */}
         <div 
            className="border-2 border-dashed rounded-xl p-7 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 mb-4 group"
            style={{ borderColor: 'rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.03)' }}
            onClick={() => document.getElementById('tf-upload')?.click()}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; e.currentTarget.style.background = 'rgba(99,102,241,0.07)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)'; e.currentTarget.style.background = 'rgba(99,102,241,0.03)'; }}
         >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110" style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>
               <Upload size={20} style={{ color: '#818cf8' }} />
            </div>
            <p className="text-sm font-semibold mb-1 text-white">Click or drag your infrastructure</p>
            <p className="text-[10px] text-gray-600">Accepts: terraform.json · plan.txt · *.tf folder</p>
            <input 
               id="tf-upload" type="file" multiple
               accept=".json,.tf,.txt,.tfplan"
               className="hidden" 
               onChange={async (e: any) => {
                  const files = e.target.files;
                  if (!files || files.length === 0) return;
                  setIsImporting(true);
                  setImportSummary(null);
                  try {
                    const fileData = await Promise.all(Array.from(files).map(async (file: any) => ({
                        name: file.webkitRelativePath || file.name,
                        content: await file.text()
                    })));
                    const result = await processTerraformFiles(fileData);
                    if (result.nodes.length > 0) {
                      setNodes(result.nodes);
                      setEdges(result.edges);
                      setImportSummary(result.summary);
                      setActiveLeftPanel('none');
                    } else {
                      alert("No recognizable AWS resources found in the uploaded files.");
                    }
                  } catch (err) {
                    console.error(err);
                    alert("Failed to parse the uploaded file(s). Check the format guide above.");
                  } finally {
                    setIsImporting(false);
                    if (e.target) e.target.value = "";
                  }
               }}
            />
         </div>

         {/* Also allow folder upload */}
         <button 
            className="w-full text-center text-[10px] text-gray-600 hover:text-gray-400 transition-colors mb-5 underline underline-offset-2 cursor-pointer"
            onClick={() => {
               const inp = document.createElement('input');
               Object.assign(inp, { type: 'file', multiple: true } as any);
               (inp as any).webkitdirectory = true;
               inp.onchange = async (e: any) => {
                  const files = (e.target as HTMLInputElement).files;
                  if (!files || files.length === 0) return;
                  setIsImporting(true); setImportSummary(null);
                  try {
                    const tfFiles = Array.from(files).filter((f) => f.name.endsWith('.tf') && ((f as any).webkitRelativePath || f.name).split('/').length - 1 <= 5);
                    const fileData = await Promise.all(tfFiles.map(async (f) => ({ name: (f as any).webkitRelativePath || f.name, content: await f.text() })));
                    const result = await processTerraformFiles(fileData);
                    if (result.nodes.length > 0) { setNodes(result.nodes); setEdges(result.edges); setImportSummary(result.summary); setActiveLeftPanel('none'); }
                    else alert("No recognizable AWS resources found.");
                  } catch { alert("Failed to parse Terraform files."); }
                  finally { setIsImporting(false); }
               };
               inp.click();
            }}
         >Or select a .tf folder instead →</button>

         {isImporting && (
            <div className="flex items-center gap-3 p-4 rounded-xl mb-5 animate-pulse" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
               <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: '#6366f1', borderTopColor: 'transparent' }}></div>
               <span className="text-sm font-medium" style={{ color: '#818cf8' }}>Analyzing and mapping services...</span>
            </div>
         )}

         <div className="mt-8">
            <h4 className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.2)' }}>Recognized Services</h4>
            <div className="grid grid-cols-3 gap-2">
                {Object.entries(SERVICE_STYLES).map(([id, s]) => (
                    <div key={id} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px]" style={{ background: `${s.color}10`, border: `1px solid ${s.color}20`, color: s.color }}>
                        <s.icon size={9} /> {s.label}
                    </div>
                ))}
            </div>
         </div>
      </div>

      {/* CENTER CANVAS */}
      <div className="flex-1 flex flex-col relative w-full h-full">
        {/* HEADER */}
        <header className="h-[70px] border-b flex items-center justify-between px-6 shrink-0 relative z-10" style={{ background: 'rgba(6,8,16,0.8)', borderColor: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)' }}>
           <div className="flex items-center gap-6">
              <div>
                <span className="font-black text-base tracking-tight" style={{ background: 'linear-gradient(135deg, #ffffff, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  AWS Cost Estimator
                </span>
                <span className="text-[9px] font-mono uppercase tracking-widest block" style={{ color: 'rgba(255,255,255,0.2)' }}>Infrastructure Simulator</span>
              </div>
              
              {/* RPS Input */}
              <div className="flex flex-col">
                 <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <Zap size={12} style={{ color: '#818cf8' }} />
                    <span className="text-xs text-gray-500">Traffic</span>
                    <input type="number" min="1" value={globalRps}
                       onChange={(e) => setGlobalRps(parseInt(e.target.value) || 1)}
                       className="bg-transparent text-sm font-mono font-bold text-white outline-none w-16 text-right"
                       style={{ color: '#818cf8' }}
                    />
                    <span className="text-xs text-gray-600">RPS</span>
                 </div>
                 <div className="text-[9px] mt-0.5 text-right font-mono" style={{ color: 'rgba(129,140,248,0.5)' }}>
                    ~{(globalRps * 86400).toLocaleString()} req/day
                 </div>
              </div>

              {/* Region */}
              <select value={region} onChange={(e) => setRegion(e.target.value)}
                className="text-xs outline-none rounded-lg px-3 py-1.5 font-mono"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}
              >
                <option value="US East (N. Virginia)">us-east-1</option>
                <option value="Europe (Ireland)">eu-west-1</option>
              </select>
           </div>

           {/* Right metrics */}
           <div className="flex items-center gap-6">
              {/* Capacity Gauge */}
              <div className="text-right">
                 <div className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.25)' }}>Arch. Capacity</div>
                 <div className="text-xl font-black font-mono" style={{ color: capacityColor }}>
                    {calculateTotalCapacity().toLocaleString()}
                    <span className="text-[9px] font-normal ml-1 opacity-60">RPS</span>
                 </div>
                 {/* Mini health bar */}
                 <div className="mt-1 h-0.5 w-24 rounded-full overflow-hidden ml-auto" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${capacityPct}%`, background: capacityColor, boxShadow: `0 0 6px ${capacityColor}` }} />
                 </div>
              </div>
              {/* Total Cost */}
              <div className="text-right pl-6 border-l" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                 <div className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.25)' }}>Monthly Cost</div>
                 <div className="text-2xl font-black font-mono" style={{ color: '#818cf8' }}>
                    ${calculateTotal()}
                 </div>
              </div>
           </div>
        </header>

        {/* CANVAS */}
        <main className="flex-1 relative w-full h-full" ref={reactFlowWrapper}>
           <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onReconnect={onReconnect}
              onDrop={onDrop}
              onDragOver={onDragOver}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              defaultEdgeOptions={defaultEdgeOptions}
              deleteKeyCode={['Backspace', 'Delete']}
              connectionMode={ConnectionMode.Loose}
              fitView
              attributionPosition="bottom-left"
            >
              <Background 
                variant={BackgroundVariant.Dots} 
                color="rgba(99,102,241,0.15)" 
                gap={24} 
                size={1.5} 
              />
              <Controls 
                className="rounded-xl overflow-hidden shadow-2xl"
                style={{ background: 'rgba(10,12,20,0.9)', border: '1px solid rgba(255,255,255,0.07)' }}
              />
              <MiniMap 
                style={{ background: 'rgba(10,12,20,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}
                nodeColor={(n) => {
                  const s = SERVICE_STYLES[n.data?.id as string];
                  return s ? s.color : '#6366f1';
                }}
                maskColor="rgba(6,8,16,0.7)"
              />

              {/* Empty State */}
              {nodes.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                  <div className="text-center">
                    <div className="text-7xl mb-6 opacity-10">⚡</div>
                    <h3 className="text-lg font-bold mb-2" style={{ color: 'rgba(255,255,255,0.15)' }}>Canvas is empty</h3>
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.08)' }}>Drag services from the right panel, or import a Terraform repo</p>
                  </div>
                </div>
              )}
           </ReactFlow>
        </main>
      </div>

      {/* RIGHT SERVICE CATALOG SIDEBAR */}
      <aside className="w-[280px] border-l flex flex-col gap-0 shrink-0 overflow-y-auto" style={{ background: 'rgba(7,9,18,0.95)', borderColor: 'rgba(255,255,255,0.06)' }}>
         {selectedNode ? (
            <div className="px-4 py-5">
              <NodeInspector node={selectedNode} onChange={updateNodeConfig} />
            </div>
         ) : categories.length === 0 ? (
            <div className="p-5 text-gray-600 text-xs italic">Loading services...</div>
         ) : (
            <>
              <div className="px-4 pt-5 pb-3 border-b sticky top-0 z-10" style={{ background: 'rgba(7,9,18,0.98)', borderColor: 'rgba(255,255,255,0.06)' }}>
                <h2 className="text-sm font-bold mb-3 text-white">Service Catalog</h2>
                <div className="relative">
                  <input 
                     type="text" placeholder="Search services..." value={searchQuery}
                     onChange={e => setSearchQuery(e.target.value)}
                     className="w-full text-xs outline-none rounded-lg px-3 py-2 pl-3 pr-8"
                     style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.8)' }}
                  />
                </div>
              </div>
              <div className="px-4 pt-4 pb-6 flex flex-col gap-5">
                {categories.map(category => {
                   const filteredServices = category.services.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
                   if (filteredServices.length === 0) return null;
                   return (
                    <div key={category.category}>
                       <h3 className="text-[9px] font-bold uppercase tracking-widest mb-2.5" style={{ color: 'rgba(255,255,255,0.2)' }}>{category.category}</h3>
                       <div className="flex flex-col gap-1.5">
                         {filteredServices.map(service => {
                            const sStyle = SERVICE_STYLES[service.id] || DEFAULT_STYLE;
                            const Icon = sStyle.icon;
                            const defaultRps = service.id === 'ec2' ? 500 : 1000;
                            return (
                              <div 
                                 key={service.id}
                                 onDragStart={(e) => onDragStart(e, { id: service.id, name: service.name, price: service.price })} 
                                 draggable 
                                 className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-grab transition-all duration-150 group"
                                 style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
                                 onMouseEnter={e => { e.currentTarget.style.background = `${sStyle.color}12`; e.currentTarget.style.borderColor = `${sStyle.color}30`; }}
                                 onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; }}
                              >
                                 <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${sStyle.color}18`, border: `1px solid ${sStyle.color}30` }}>
                                    <Icon size={13} style={{ color: sStyle.color }} />
                                 </div>
                                 <div className="flex-1 min-w-0">
                                    <div className="text-[11px] font-medium text-white truncate">{service.name}</div>
                                    <div className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>${service.price.toFixed(2)}/mo · {defaultRps} RPS</div>
                                 </div>
                              </div>
                            );
                         })}
                       </div>
                    </div>
                   )
                })}
              </div>
            </>
         )}
      </aside>
    </div>
  );
}
