export interface NodeConfig {
  instances?: number;
  [key: string]: any;
}

/**
 * Main engine entry point. Routes to specific calculators based on service ID.
 */
export function calculateServicePrice(serviceId: string, basePrice: number, config: NodeConfig | undefined, globalContext: { rps: number } = { rps: 10 }): number {
  if (!config) return basePrice * 1;

  // By default, assume the manual configured instances count
  let multiplier = config.instances || 1;

  switch (serviceId.toLowerCase()) {
    case 'ec2':
      return calculateEC2Pricing(config, globalContext);
    case 's3':
      return calculateS3Pricing(config, globalContext) * multiplier;
    case 'lambda':
      return calculateLambdaPricing(config, globalContext) * multiplier;
    case 'apigateway':
      return calculateAPIGatewayPricing(globalContext) * multiplier;
    case 'rds':
      return calculateRDSPricing(config) * multiplier;
    default:
      // Fallback: If no custom calculator exists, multiply the base API price
      return basePrice * multiplier;
  }
}

// ==== SIMULATED RATE CARDS ====

function calculateAPIGatewayPricing(globalContext: any): number {
  const reqsPerMonth = globalContext.rps * 2_592_000;
  return (reqsPerMonth / 1_000_000) * 3.50; // $3.50 per million
}

function calculateEC2Pricing(config: any, globalContext: any): number {
  const { instanceType = 't3.micro', hours = 730, os = 'Linux', purchaseOption = 'on-demand' } = config;
  
  const rates: any = {
    'Linux': { 't3.micro': 0.0104, 't3.medium': 0.0416, 'm5.large': 0.096, 'c5.large': 0.085 },
    'Windows': { 't3.micro': 0.015, 't3.medium': 0.06, 'm5.large': 0.188, 'c5.large': 0.177 }
  };
  
  const hourly = rates[os]?.[instanceType] || 0.0104;
  
  // Approximate standard AWS purchase model discounts
  let multiplier = 1.0;
  switch (purchaseOption) {
    case 'spot': multiplier = 0.35; break;
    case 'sp-1yr-no': multiplier = 0.72; break;
    case 'sp-1yr-partial': multiplier = 0.68; break;
    case 'sp-1yr-all': multiplier = 0.64; break;
    case 'sp-3yr-no': multiplier = 0.48; break;
    case 'sp-3yr-partial': multiplier = 0.44; break;
    case 'sp-3yr-all': multiplier = 0.40; break;
    case 'ri-1yr-std': multiplier = 0.60; break;
    case 'ri-3yr-std': multiplier = 0.38; break;
    case 'ri-1yr-conv': multiplier = 0.68; break;
    case 'ri-3yr-conv': multiplier = 0.46; break;
    case 'dedicated-host': multiplier = 1.50; break;
    case 'on-demand':
    default:
      multiplier = 1.0;
  }
  
  // Auto scaling simulation:
  const manualInstances = config.instances || 1;
  const limitRps = config.maxRps || 500; // Capacity per instance
  const neededInstances = Math.max(1, Math.ceil(globalContext.rps / limitRps));
  
  // Choose highest of either manual scale or auto-scale needed
  const finalInstances = Math.max(manualInstances, neededInstances);
  
  return hourly * multiplier * hours * finalInstances;
}

function calculateS3Pricing(config: any, globalContext: any): number {
  const { storageGB = 100, dataOutGB = 50, requests10k = 10 } = config;
  
  const storageCost = storageGB * 0.023; // Standard storage
  const egressCost = Math.max(0, dataOutGB - 100) * 0.09; // First 100GB out is free
  const requestsCost = requests10k * 0.05; // ~ $0.005 per 1,000 requests = 0.05 per 10k
  
  return storageCost + egressCost + requestsCost;
}

function calculateLambdaPricing(config: any, globalContext: any): number {
  const { memoryMB = 512, durationMs = 200 } = config;
  
  // Calculate from global RPS
  const totalInvocations = globalContext.rps * 2_592_000;
  
  // $0.20 per 1M requests
  // $0.0000166667 per GB-second
  const requestCost = (totalInvocations / 1_000_000) * 0.20;
  
  const memoryGB = memoryMB / 1024;
  const totalSeconds = totalInvocations * (durationMs / 1000);
  const gbSeconds = memoryGB * totalSeconds;
  
  const computeCost = gbSeconds * 0.0000166667;
  
  return requestCost + computeCost;
}

function calculateRDSPricing(config: any): number {
  const { instanceClass = 'db.t3.micro', storageGB = 20, multiAZ = false } = config;
  
  const rates: any = {
    'db.t3.micro': 0.017,
    'db.t3.medium': 0.068,
    'db.m5.large': 0.24,
  };
  
  const hourly = rates[instanceClass] || 0.017;
  const compute = hourly * 730 * (multiAZ ? 2 : 1);
  const storage = storageGB * 0.115 * (multiAZ ? 2 : 1); // GP2 storage rate
  
  return compute + storage;
}
