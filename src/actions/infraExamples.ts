"use server";

import * as fs from 'fs';
import * as path from 'path';
import { processTerraformFiles, ImportResult } from './terraformImport';

export interface InfraExample {
  id: string;
  title: string;
  description: string;
  tag: string;
  tagColor: string;
  services: string[];   // list of service ids visible in the plan
  planPath: string;     // relative path from project root
}

// Declarative list of examples tied to their plan files
const EXAMPLES: InfraExample[] = [
  {
    id: 'banking-system',
    title: 'Banking Core (EKS + RDS)',
    description: 'Production-grade banking infrastructure with EKS, multi-AZ RDS, internal ALB, KMS encryption, and CloudTrail audit logging.',
    tag: 'Enterprise',
    tagColor: '#ef4444',
    services: ['eks', 'rds', 'alb', 'vpc', 's3', 'dynamodb', 'kms', 'cloudtrail'],
    planPath: 'infra/terraform-banking-system/plan.tfplan.json',
  },
  {
    id: 'wordpress-fargate',
    title: 'WordPress on Fargate',
    description: 'Fully managed WordPress deployment with CloudFront CDN, ALB, Fargate containers, RDS MySQL, and EFS persistent storage.',
    tag: 'Containers',
    tagColor: '#ec4899',
    services: ['cloudfront', 'alb', 'fargate', 'rds', 'efs', 'route53', 'vpc'],
    planPath: 'infra/aws/wordpress_fargate/plan.tfplan.json',
  },
  {
    id: 'lambda-api',
    title: 'Serverless Lambda API',
    description: 'API Gateway-fronted Lambda backend with JWT authorizer, DynamoDB session store, and S3 artifact bucket.',
    tag: 'Serverless',
    tagColor: '#a855f7',
    services: ['apigateway', 'lambda', 'dynamodb', 's3', 'route53'],
    planPath: 'infra/aws/aws_lambda_api/plan.tfplan.json',
  },
  {
    id: 'static-site',
    title: 'Static Website + CDN',
    description: 'Production-ready static site with private S3 origin, CloudFront distribution, and Route 53 DNS.',
    tag: 'Frontend',
    tagColor: '#22c55e',
    services: ['s3', 'cloudfront', 'route53'],
    planPath: 'infra/aws/static_website_ssl_cloudfront_private_s3/plan.tfplan.json',
  },
];

/**
 * Returns the list of available examples with metadata (no file content).
 */
export async function listInfraExamples(): Promise<InfraExample[]> {
  return EXAMPLES;
}

/**
 * Loads and parses a specific example by ID.
 */
export async function loadInfraExample(id: string): Promise<ImportResult> {
  const example = EXAMPLES.find(e => e.id === id);
  if (!example) throw new Error(`Example "${id}" not found.`);

  const absPath = path.join(process.cwd(), example.planPath);

  if (!fs.existsSync(absPath)) {
    throw new Error(`Plan file not found: ${example.planPath}`);
  }

  const content = fs.readFileSync(absPath, 'utf-8');
  const fileName  = path.basename(absPath);

  return processTerraformFiles([{ name: fileName, content }]);
}
