import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { processTerraformFiles } from '../src/actions/terraformImport';

describe('Terraform Banking System Import Test', () => {
    it('should correctly parse the banking system infrastructure from folder-like structure', async () => {
        // 1. Prepare mock file data from the actual infra folder
        const infraPath = path.join(process.cwd(), 'infra/terraform-banking-system');
        
        // Helper to recursively read .tf files
        const getAllTfFiles = (dir: string, baseDir: string): { name: string, content: string }[] => {
            const files: { name: string, content: string }[] = [];
            const items = fs.readdirSync(dir);
            
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const relPath = path.relative(baseDir, fullPath);
                
                if (fs.statSync(fullPath).isDirectory()) {
                    files.push(...getAllTfFiles(fullPath, baseDir));
                } else if (item.endsWith('.tf')) {
                    files.push({
                        name: relPath,
                        content: fs.readFileSync(fullPath, 'utf-8')
                    });
                }
            }
            return files;
        };

        const fileData = getAllTfFiles(infraPath, infraPath);
        
        // 2. Process the files
        const result = await processTerraformFiles(fileData);
        
        // 3. Assertions
        
        // Check for VPC (resource)
        const vpcNode = result.nodes.find(n => n.data.id === 'vpc');
        expect(vpcNode).toBeDefined();
        
        // Check for EKS (module)
        const eksNode = result.nodes.find(n => n.data.id === 'eks');
        expect(eksNode).toBeDefined();
        expect(eksNode.data.name.toLowerCase()).toContain('eks');

        // Check for Edges (EKS -> VPC dependencies)
        // Note: Production main.tf has: vpc_id = module.network.vpc_id
        // In our parser, module.compute depends on module.network
        const clusterEdge = result.edges.find(e => e.target === 'module.compute' && e.source === 'module.network');
        expect(clusterEdge).toBeDefined();
        expect(clusterEdge.animated).toBe(true);

        console.log(`Successfully parsed ${result.nodes.length} nodes and ${result.edges.length} edges from Banking System.`);
    });
});
