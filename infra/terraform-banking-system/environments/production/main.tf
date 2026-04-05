provider "aws" {
  region = "us-east-1"
}

module "network" {
  source   = "../../modules/vpc"
  vpc_cidr = "10.0.0.0/16"
}

module "compute" {
  source          = "../../modules/eks"
  vpc_id          = module.network.vpc_id
  private_subnets = module.network.private_subnets
}

module "auth_db" {
  source            = "../../modules/rds"
  db_name           = "auth_service_db"
  multi_az          = true
}