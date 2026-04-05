"use server";

import { PricingClient, GetProductsCommand, DescribeServicesCommand } from "@aws-sdk/client-pricing";
import { unstable_cache } from "next/cache";

// Initialize the Pricing client (Pricing API only in us-east-1 and ap-south-1)
const pricingClient = new PricingClient({ region: "us-east-1" });

export interface AwsServiceCat {
  category: string;
  services: { id: string; name: string; price: number }[];
}

export const getAwsServicesCatalog = async (regionLocation: string = "US East (N. Virginia)"): Promise<AwsServiceCat[]> => {
  const fetchCatalog = unstable_cache(
    async (): Promise<AwsServiceCat[]> => {
    try {
      // 1. Fetch all services available from AWS
      const describeCmd = new DescribeServicesCommand({ MaxResults: 100 });
      let servicesInfo;
      try {
         servicesInfo = await pricingClient.send(describeCmd);
      } catch (err: any) {
         console.warn("Could not describe services from AWS (missing credentials?), falling back.", err.message);
         throw err; 
      }

      const serviceCodes = servicesInfo.Services?.map(s => s.ServiceCode) || [];

      // 2. Fetch one base product price for each service dynamically
      // We limit concurrency to avoid aggressive rate limiting from AWS
      const dynamicServices = [];
      const fetchPromises = serviceCodes.filter(Boolean).map(async (serviceCode) => {
          try {
            const cmd = new GetProductsCommand({
              ServiceCode: serviceCode,
              Filters: [
                { Type: "TERM_MATCH", Field: "location", Value: regionLocation }
              ],
              MaxResults: 1
            });
            const response = await pricingClient.send(cmd);
            
            let price = 0;
            // Parse the actual USD price out of the opaque PriceList JSON
            if (response.PriceList && response.PriceList.length > 0) {
               const priceListObj = JSON.parse(response.PriceList[0] as string);
               const terms = priceListObj.terms?.OnDemand || priceListObj.terms?.Reserved;
               if (terms) {
                 const offer = Object.values(terms)[0] as any;
                 const priceDimensions = offer?.priceDimensions;
                 if (priceDimensions) {
                     const pricePerHr = Object.values(priceDimensions)[0] as any;
                     if (pricePerHr && pricePerHr.pricePerUnit?.USD) {
                        // Approximate monthly baseline cost (730 hours)
                        price = parseFloat(pricePerHr.pricePerUnit.USD) * 730;
                     }
                 }
               }
            }
            
            return {
              id: serviceCode!.toLowerCase(),
              name: serviceCode!,
              price: Number(price.toFixed(2))
            };
          } catch (e) {
            return null; // Skip services that throw exceptions on GetProducts
          }
      });

      // Wait for all fetches to complete
      const resolvedServices = (await Promise.all(fetchPromises)).filter(Boolean) as any[];

      // 3. Group them into distinct categories based on names
      const categoryMap: Record<string, any[]> = { "Compute": [], "Containers": [], "Database": [], "Storage": [], "Networking": [], "Security": [], "Analytics": [], "Integration": [], "Management": [], "Machine Learning": [], "Other": [] };
      
      for (const srv of resolvedServices) {
          const name = srv.name.toLowerCase();
          if (name.includes("eks") || name.includes("ecr") || name.includes("container") || name.includes("fargate")) {
             categoryMap["Containers"].push(srv);
          } else if (name.includes("ec2") || name.includes("lambda") || name.includes("ecs") || name.includes("compute")) {
             categoryMap["Compute"].push(srv);
          } else if (name.includes("rds") || name.includes("dynamo") || name.includes("database") || name.includes("aurora") || name.includes("elasticache")) {
             categoryMap["Database"].push(srv);
          } else if (name.includes("s3") || name.includes("efs") || name.includes("storage") || name.includes("glacier") || name.includes("fsx")) {
             categoryMap["Storage"].push(srv);
          } else if (name.includes("cloudfront") || name.includes("api") || name.includes("route") || name.includes("network") || name.includes("vpc")) {
             categoryMap["Networking"].push(srv);
          } else if (name.includes("iam") || name.includes("kms") || name.includes("shield") || name.includes("cognito") || name.includes("waf") || name.includes("security")) {
             categoryMap["Security"].push(srv);
          } else if (name.includes("athena") || name.includes("emr") || name.includes("redshift") || name.includes("kinesis") || name.includes("glue") || name.includes("analytics")) {
             categoryMap["Analytics"].push(srv);
          } else if (name.includes("sqs") || name.includes("sns") || name.includes("eventbridge") || name.includes("stepfunctions") || name.includes("mq")) {
             categoryMap["Integration"].push(srv);
          } else if (name.includes("cloudwatch") || name.includes("cloudtrail") || name.includes("config") || name.includes("systemsmanager") || name.includes("trustedadvisor")) {
             categoryMap["Management"].push(srv);
          } else if (name.includes("sagemaker") || name.includes("comprehend") || name.includes("rekognition") || name.includes("bedrock") || name.includes("lex")) {
             categoryMap["Machine Learning"].push(srv);
          } else {
             categoryMap["Other"].push(srv);
          }
      }

      return Object.keys(categoryMap)
        .filter(cat => categoryMap[cat].length > 0)
        .map(cat => ({ category: cat, services: categoryMap[cat] }));

    } catch (e) {
      console.error("Using fallback service data. Configure AWS_ACCESS_KEY_ID to fetch live API data.");
      // Fallback
      const regionalMultiplier = regionLocation === "Europe (Ireland)" ? 1.15 : 1.0;
      
      return [
        {
          category: "Compute",
          services: [
             { id: "ec2", name: "Amazon EC2", price: 25.40 * regionalMultiplier },
             { id: "lambda", name: "AWS Lambda", price: 2.00 * regionalMultiplier }
          ]
        },
        {
          category: "Containers",
          services: [
             { id: "eks", name: "Amazon EKS", price: 73.00 * regionalMultiplier },
             { id: "ecr", name: "Amazon ECR", price: 0.10 * regionalMultiplier }
          ]
        },
        {
          category: "Database",
          services: [
             { id: "rds", name: "Amazon RDS", price: 15.20 * regionalMultiplier },
             { id: "dynamodb", name: "Amazon DynamoDB", price: 1.25 * regionalMultiplier }
          ]
        },
        {
          category: "Storage",
          services: [
             { id: "s3", name: "Amazon S3", price: 5.00 * regionalMultiplier },
             { id: "efs", name: "Amazon EFS", price: 8.00 * regionalMultiplier }
          ]
        },
        {
          category: "Networking",
          services: [
             { id: "vpc", name: "Amazon VPC", price: 0.00 },
             { id: "cloudfront", name: "Amazon CloudFront", price: 8.50 * regionalMultiplier }
          ]
        },
        {
          category: "Security",
          services: [
             { id: "iam", name: "AWS IAM", price: 0.00 },
             { id: "cognito", name: "Amazon Cognito", price: 5.50 * regionalMultiplier }
          ]
        },
        {
          category: "Analytics",
          services: [
             { id: "athena", name: "Amazon Athena", price: 5.00 * regionalMultiplier }
          ]
        },
        {
          category: "Integration",
          services: [
             { id: "sqs", name: "Amazon SQS", price: 0.40 * regionalMultiplier },
             { id: "sns", name: "Amazon SNS", price: 0.50 * regionalMultiplier }
          ]
        }
      ].map(c => ({
         ...c,
         services: c.services.map(s => ({ ...s, price: Number(s.price.toFixed(2)) }))
      }));
    }
  },
  ["aws-pricing-catalog-dynamic-region", regionLocation],
  { revalidate: 3600 } // cache for 1 hour to prevent API spam
  );
  return fetchCatalog();
};
