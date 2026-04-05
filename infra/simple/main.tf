# Simple 3-Tier Architecture
provider "aws" {
  region = "us-east-1"
}

resource "aws_lb" "web_lb" {
  name               = "simple-web-lb"
  internal           = false
  load_balancer_type = "application"
}

resource "aws_instance" "web_server" {
  count         = 2
  ami           = "ami-0c55b159cbfafe1f0" // Amazon Linux
  instance_type = "t3.micro"
}

resource "aws_db_instance" "database" {
  identifier           = "simple-rds"
  allocated_storage    = 20
  engine               = "postgres"
  instance_class       = "db.t3.micro"
  multi_az             = false
}

resource "aws_s3_bucket" "assets" {
  bucket = "simple-app-assets"
}
