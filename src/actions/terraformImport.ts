"use server";

// =========================================================================
// TYPES
// =========================================================================

export interface ParsedResource {
  type: string;
  name: string;
  id: string;
  attributes: Record<string, any>;
  dependencies: string[];
}

export interface ImportResult {
  nodes: any[];
  edges: any[];
  summary: {
    total: number;
    created: number;
    updated: number;
    noChange: number;
    source: 'terraform-plan-json' | 'terraform-plan-text' | 'terraform-hcl';
  };
}

// =========================================================================
// TERRAFORM PLAN JSON FORMAT  (terraform show -json plan.tfplan)
// =========================================================================

interface TfPlanResourceChange {
  address: string;
  module_address?: string;
  mode: string;
  type: string;
  name: string;
  index?: string | number;
  provider_name: string;
  change: {
    actions: string[];
    before: Record<string, any> | null;
    after: Record<string, any> | null;
    after_unknown: Record<string, boolean>;
  };
}

interface TfPlanJson {
  format_version: string;
  terraform_version?: string;
  resource_changes?: TfPlanResourceChange[];
  planned_values?: {
    root_module?: {
      resources?: Array<{ address: string; type: string; name: string; values: Record<string, any> }>;
      child_modules?: Array<{ address: string; resources?: Array<{ address: string; type: string; name: string; values: Record<string, any> }> }>;
    };
  };
  configuration?: {
    root_module?: {
      resources?: Array<{
        address: string;
        type: string;
        name: string;
        depends_on?: string[];
        expressions?: Record<string, any>; // nested object; leaf nodes have { references: string[] }
      }>;
      module_calls?: Record<string, { source: string; expressions?: Record<string, any>; depends_on?: string[] }>;
    };
  };
}

/**
 * Recursively walks a terraform expressions object and collects all
 * `references` arrays into a flat deduplicated list.
 *
 * Example input:
 * {
 *   "load_balancer_arn": { "references": ["aws_lb.main"] },
 *   "default_action": {
 *     "target_group_arn": { "references": ["aws_lb_target_group.app"] }
 *   }
 * }
 */
function extractRefsFromExpressions(obj: Record<string, any>): string[] {
  const refs: string[] = [];
  for (const value of Object.values(obj)) {
    if (!value || typeof value !== 'object') continue;
    if (Array.isArray(value.references)) {
      // leaf node: { references: ["aws_xxx.yyy", ...] }
      for (const r of value.references as string[]) {
        // Filter to only resource references (skip "var.", "data.", "path." etc.)
        if (r.startsWith('aws_') || r.startsWith('module.')) {
          const clean = r.replace(/\[.*?\]/g, ''); // strip [0] index
          if (!refs.includes(clean)) refs.push(clean);
        }
      }
    } else {
      // inner node: recurse
      refs.push(...extractRefsFromExpressions(value));
    }
  }
  return refs;
}

function parseTerraformPlanJson(content: string): ParsedResource[] {
  const plan: TfPlanJson = JSON.parse(content);
  const resources: ParsedResource[] = [];

  const actionMap: Record<string, string> = {
    'create':  'create',
    'update':  'update',
    'no-op':   'no_change',
    'read':    'read',
    'delete':  'delete',
  };

  // Build a lookup map from configuration to get expressions for each resource address
  const configByAddress: Record<string, { depends_on?: string[]; expressions?: Record<string, any> }> = {};
  for (const cr of plan.configuration?.root_module?.resources ?? []) {
    configByAddress[cr.address] = cr as any;
  }

  // Primary source: resource_changes
  if (plan.resource_changes) {
    for (const rc of plan.resource_changes) {
      if (rc.mode === 'data') continue;
      const actions = rc.change.actions;
      if (actions.length === 1 && actions[0] === 'delete') continue;

      // Build attributes from `after`
      const attributes: Record<string, any> = {};
      const after = rc.change.after || rc.change.before || {};
      for (const [k, v] of Object.entries(after)) {
        if (v !== null && typeof v !== 'object') {
          attributes[k] = String(v);
        } else if (Array.isArray(v) && v.length > 0 && typeof v[0] !== 'object') {
          attributes[k] = v.join(', ');
        }
      }

      attributes['_action'] = actionMap[actions[0]] || actions[0];

      // Build dependencies:
      // Priority 1 — configuration.expressions.references (richest source)
      // Priority 2 — configuration.depends_on (explicit)
      const configRes = configByAddress[rc.address];
      const dependencies: string[] = [];

      if (configRes?.expressions) {
        dependencies.push(...extractRefsFromExpressions(configRes.expressions));
      }
      if (configRes?.depends_on) {
        for (const d of configRes.depends_on) {
          const clean = d.replace(/\[.*?\]/g, '');
          if (!dependencies.includes(clean)) dependencies.push(clean);
        }
      }

      resources.push({
        type: rc.type,
        name: rc.name,
        id: rc.address.replace(/\[.*?\]/, ''), // strip [0] index suffixes
        attributes,
        dependencies,
      });
    }
  }

  // Secondary source: planned_values child_modules (for module-based plans that have no resource_changes entries)
  const alreadySeen = new Set(resources.map(r => r.id));
  const flattenModule = (mod: any) => {
    if (mod?.resources) {
      for (const r of mod.resources) {
        const cleanId = r.address.replace(/\[.*?\]/, '');
        if (alreadySeen.has(cleanId)) continue;
        const attributes: Record<string, any> = {};
        for (const [k, v] of Object.entries(r.values || {})) {
          if (v !== null && typeof v !== 'object') attributes[k] = String(v);
        }
        attributes['_action'] = 'no_change';
        resources.push({ type: r.type, name: r.name, id: cleanId, attributes, dependencies: [] });
        alreadySeen.add(cleanId);
      }
    }
    if (mod?.child_modules) {
      for (const child of mod.child_modules) flattenModule(child);
    }
  };
  flattenModule(plan.planned_values?.root_module);

  return resources;
}

// =========================================================================
// TERRAFORM PLAN TEXT FORMAT  (terraform plan — human-readable stdout)
// =========================================================================

function parseTerraformPlanText(content: string): ParsedResource[] {
  const resources: ParsedResource[] = [];
  
  // Match lines like: # aws_xxx.name will be created / updated / unchanged
  const headerRegex = /^  # ([\w.[\]"]+)\s+will be\s+(created|updated in-place|destroyed|replaced|read during apply)/gm;
  // Also match:       # aws_xxx.name is tainted, so must be replaced
  const blockRegex  = /[+-~]\s+resource\s+"([^"]+)"\s+"([^"]+)"\s+\{([\s\S]*?)^\s+\}/gm;

  // First stash which addresses have which action
  const actionsByAddress: Record<string, string> = {};
  let m;
  while ((m = headerRegex.exec(content)) !== null) {
    const address = m[1].replace(/\[.*?\]/g, '');
    const verb = m[2];
    actionsByAddress[address] = verb.includes('created') ? 'create' : verb.includes('updated') ? 'update' : 'no_change';
  }

  // Parse resource blocks
  while ((m = blockRegex.exec(content)) !== null) {
    const [, type, name, body] = m;
    const id = `${type}.${name}`;
    const attributes: Record<string, string> = {};

    // Extract simple + key = "value" lines
    const attrRegex = /[+~]\s+([a-z0-9_]+)\s+=\s+"?([^"\n{]+)"?/gm;
    let am;
    while ((am = attrRegex.exec(body)) !== null) {
      attributes[am[1]] = am[2].trim();
    }

    attributes['_action'] = actionsByAddress[id] || 'create';

    resources.push({ type, name, id, attributes, dependencies: [] });
  }

  // If no blocks matched (compact plan output), fall back to just the address/action pairs
  if (resources.length === 0) {
    const simpleRegex = /(?:will be created|will be updated|will be replaced)/g;
    for (const [id, action] of Object.entries(actionsByAddress)) {
      const parts = id.split('.');
      if (parts.length >= 2) {
        resources.push({
          type: parts[0],
          name: parts[1],
          id,
          attributes: { _action: action },
          dependencies: [],
        });
      }
    }
  }

  return resources;
}

// =========================================================================
// HCL FILE FORMAT  (.tf files — existing feature)
// =========================================================================

function extractResourcesFromHcl(content: string): ParsedResource[] {
  const resources: ParsedResource[] = [];

  // 1. Parse resource blocks
  const resourceRegex = /resource\s+"([^"]+)"\s+"([^"]+)"\s+\{([\s\S]*?)\n\}/g;
  let match;
  while ((match = resourceRegex.exec(content)) !== null) {
    const [, type, name, body] = match;
    resources.push(parseHclBlock(type, name, `${type}.${name}`, body));
  }

  // 2. Parse module blocks
  const moduleRegex = /module\s+"([^"]+)"\s+\{([\s\S]*?)\n\}/g;
  let moduleMatch;
  while ((moduleMatch = moduleRegex.exec(content)) !== null) {
    const [, name, body] = moduleMatch;
    resources.push(parseHclBlock('module', name, `module.${name}`, body));
  }

  return resources;
}

function parseHclBlock(type: string, name: string, internalId: string, body: string): ParsedResource {
  const attributes: Record<string, string> = {};
  const attrRegex = /^\s*([a-z0-9_]+)\s*=\s*(.*)$/gm;
  let m;
  while ((m = attrRegex.exec(body)) !== null) {
    attributes[m[1]] = m[2].replace(/"/g, '').trim();
  }

  const dependencies: string[] = [];
  const depRegex = /(aws_[a-z0-9_]+\.[a-z0-9_-]+|module\.[a-z0-9_-]+)/g;
  let d;
  while ((d = depRegex.exec(body)) !== null) {
    const depId = d[1];
    if (depId !== internalId && !dependencies.includes(depId)) dependencies.push(depId);
  }

  return { type, name, id: internalId, attributes, dependencies };
}

// =========================================================================
// RESOURCE → NODE/EDGE MAPPER (shared)
// =========================================================================

const TYPE_MAP: Record<string, string> = {
  aws_instance: 'ec2',
  aws_lambda_function: 'lambda',
  aws_db_instance: 'rds',
  aws_rds_cluster: 'rds',
  aws_s3_bucket: 's3',
  aws_lb: 'alb',
  aws_alb: 'alb',
  aws_ecs_service: 'fargate',
  aws_ecs_cluster: 'fargate',
  aws_efs_file_system: 'efs',
  aws_route53_zone: 'route53',
  aws_route53_record: 'route53',
  aws_apigatewayv2_api: 'apigateway',
  aws_api_gateway_rest_api: 'apigateway',
  aws_dynamodb_table: 'dynamodb',
  aws_cloudfront_distribution: 'cloudfront',
  aws_kinesis_stream: 'kinesis',
  aws_kinesis_firehose_delivery_stream: 'kinesis',
  aws_msk_cluster: 'msk',
  aws_elasticache_cluster: 'elasticache',
  aws_elasticache_replication_group: 'elasticache',
  aws_vpc: 'vpc',
  aws_eks_cluster: 'eks',
  aws_eks_node_group: 'eks',
  aws_glue_catalog_database: 'glue',
  aws_glue_job: 'glue',
  aws_athena_workgroup: 'athena',
  aws_kms_key: 'kms',
  aws_cloudtrail: 'cloudtrail',
  aws_sqs_queue: 'sqs',
  aws_sns_topic: 'sns',
  aws_cognito_user_pool: 'cognito',
};

const NAME_MAP: Record<string, string> = {
  ec2: 'Amazon EC2',
  lambda: 'AWS Lambda',
  rds: 'Amazon RDS',
  s3: 'Amazon S3',
  alb: 'Application Load Balancer',
  fargate: 'AWS Fargate / ECS',
  efs: 'Amazon EFS',
  route53: 'Amazon Route 53',
  apigateway: 'Amazon API Gateway',
  dynamodb: 'Amazon DynamoDB',
  cloudfront: 'Amazon CloudFront',
  kinesis: 'Amazon Kinesis',
  msk: 'Amazon MSK',
  elasticache: 'Amazon ElastiCache',
  vpc: 'Amazon VPC',
  eks: 'Amazon EKS',
  glue: 'AWS Glue',
  athena: 'Amazon Athena',
  kms: 'AWS KMS',
  cloudtrail: 'AWS CloudTrail',
  sqs: 'Amazon SQS',
  sns: 'Amazon SNS',
  cognito: 'Amazon Cognito',
};

// Action → badge color
const ACTION_STYLES: Record<string, { label: string; color: string }> = {
  create:    { label: '+ create',   color: '#22c55e' },
  update:    { label: '~ update',   color: '#f59e0b' },
  no_change: { label: '✓ exists',   color: '#64748b' },
  delete:    { label: '- destroy',  color: '#ef4444' },
};

function inferModuleService(res: ParsedResource): string | undefined {
  const source = (res.attributes['source'] || '').toLowerCase();
  const name   = res.name.toLowerCase();
  if (source.includes('eks')   || name.includes('eks'))                         return 'eks';
  if (source.includes('rds')   || name.includes('db') || name.includes('sql'))  return 'rds';
  if (source.includes('vpc')   || name.includes('network') || name.includes('vpc')) return 'vpc';
  if (source.includes('s3')    || name.includes('bucket'))                      return 's3';
  if (source.includes('lambda'))                                                 return 'lambda';
  if (source.includes('alb')   || source.includes('lb'))                        return 'alb';
  if (source.includes('cloudfront'))                                             return 'cloudfront';
  if (source.includes('kinesis'))                                                return 'kinesis';
  if (source.includes('msk')   || name.includes('kafka'))                       return 'msk';
  return undefined;
}

function generateNodesAndEdges(resources: ParsedResource[]): Omit<ImportResult, 'summary'> & { summary?: any } {
  const nodes: any[] = [];
  const edges: any[] = [];

  resources.forEach((res, index) => {
    let serviceId = TYPE_MAP[res.type];
    if (res.type === 'module') serviceId = inferModuleService(res) as string;
    if (!serviceId) return;

    const row = Math.floor(index / 4);
    const col = index % 4;

    const action = res.attributes['_action'] || 'no_change';
    const actionStyle = ACTION_STYLES[action] || ACTION_STYLES.no_change;

    nodes.push({
      id: res.id,
      type: 'serviceNode',
      position: { x: col * 270 + 60, y: row * 200 + 100 },
      data: {
        id: serviceId,
        name: NAME_MAP[serviceId] || res.name,
        price: 0,
        basePrice: 0,
        action: actionStyle,
        config: {
          instances: parseInt(res.attributes['desired_size'] || res.attributes['min_size'] || '1', 10) || 1,
          maxRps: serviceId === 'ec2' ? 500 : 1000,
          instanceType: res.attributes['instance_type'] || res.attributes['node_type'] || undefined,
          ...res.attributes,
        },
      },
    });
  });

  // Transitive edge detection
  const visualNodeIds = nodes.map(n => n.id);
  nodes.forEach(targetNode => {
    const res = resources.find(r => r.id === targetNode.id);
    if (!res) return;
    const visualDeps = findVisualDeps(res.id, resources, visualNodeIds, new Set());
    visualDeps.forEach(sourceId => {
      if (sourceId !== targetNode.id) {
        edges.push({
          id: `edge-${sourceId}-${targetNode.id}`,
          source: sourceId,
          target: targetNode.id,
          animated: true,
          style: { stroke: '#6366f1', strokeWidth: 1.5 },
        });
      }
    });
  });

  return { nodes, edges };
}

function findVisualDeps(resId: string, all: ParsedResource[], visualIds: string[], visited: Set<string>): string[] {
  if (visited.has(resId)) return [];
  visited.add(resId);
  const res = all.find(r => r.id === resId);
  if (!res) return [];
  const result: string[] = [];
  for (const dep of res.dependencies) {
    if (visualIds.includes(dep)) result.push(dep);
    else result.push(...findVisualDeps(dep, all, visualIds, visited));
  }
  return Array.from(new Set(result));
}

// =========================================================================
// PUBLIC API
// =========================================================================

/**
 * Accepts:
 *   - A single JSON plan file (terraform show -json)  → name ends in .json or content has "resource_changes"
 *   - A single text plan file                         → name ends in .tfplan or .txt, content has "Terraform will"
 *   - One or more .tf source files                    → existing HCL parser
 */
export async function processTerraformFiles(
  files: { name: string; content: string }[]
): Promise<ImportResult> {
  // ---- 1. JSON Plan ----
  const jsonFile = files.find(f =>
    f.name.endsWith('.json') || (f.content.trim().startsWith('{') && f.content.includes('resource_changes'))
  );
  if (jsonFile) {
    try {
      const resources = parseTerraformPlanJson(jsonFile.content);
      const { nodes, edges } = generateNodesAndEdges(resources);
      return {
        nodes, edges,
        summary: {
          total: nodes.length,
          created:  resources.filter(r => r.attributes['_action'] === 'create').length,
          updated:  resources.filter(r => r.attributes['_action'] === 'update').length,
          noChange: resources.filter(r => r.attributes['_action'] === 'no_change').length,
          source: 'terraform-plan-json',
        },
      };
    } catch (e) {
      console.warn('JSON plan parse failed, falling back:', e);
    }
  }

  // ---- 2. Text Plan ----
  const textFile = files.find(f =>
    f.name.endsWith('.tfplan') || f.name.endsWith('.txt') ||
    f.content.includes('Terraform will perform') || f.content.includes('will be created')
  );
  if (textFile) {
    const resources = parseTerraformPlanText(textFile.content);
    if (resources.length > 0) {
      const { nodes, edges } = generateNodesAndEdges(resources);
      return {
        nodes, edges,
        summary: {
          total:    nodes.length,
          created:  resources.filter(r => r.attributes['_action'] === 'create').length,
          updated:  resources.filter(r => r.attributes['_action'] === 'update').length,
          noChange: resources.filter(r => r.attributes['_action'] === 'no_change').length,
          source: 'terraform-plan-text',
        },
      };
    }
  }

  // ---- 3. HCL Source Files ----
  const allResources: ParsedResource[] = [];
  for (const file of files.filter(f => f.name.endsWith('.tf'))) {
    allResources.push(...extractResourcesFromHcl(file.content));
  }
  const { nodes, edges } = generateNodesAndEdges(allResources);
  return {
    nodes, edges,
    summary: {
      total:    nodes.length,
      created:  0,
      updated:  0,
      noChange: nodes.length,
      source: 'terraform-hcl',
    },
  };
}
