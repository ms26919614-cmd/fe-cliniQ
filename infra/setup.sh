#!/bin/bash
# ===========================
# CliniQ Frontend - AWS Infra Setup
# Reuses existing: VPC, Subnets, ALB, ECS Cluster, Security Groups
# Creates: ECR repo, Target Group, ALB Listener Rule, ECS Task Def, ECS Service
# ===========================

set -e

export AWS_PAGER=""

REGION="us-east-1"
ACCOUNT_ID="719279823817"
CLUSTER="cliniq-cluster"
ALB_ARN="arn:aws:elasticloadbalancing:us-east-1:719279823817:loadbalancer/app/cliniq-alb/fcfae21623a9097b"
VPC_ID="vpc-00dda49ee7bb51aca"
BE_API_URL="http://cliniq-alb-313587609.us-east-1.elb.amazonaws.com"

echo "========================================="
echo "CliniQ Frontend - AWS Infrastructure Setup"
echo "========================================="

# ------------------------------------------
# Step 1: Create ECR Repository
# ------------------------------------------
echo ""
echo "Step 1: Creating ECR Repository..."
aws ecr create-repository \
  --repository-name cliniq-frontend \
  --region $REGION 2>/dev/null || echo "ECR repo already exists"

# ------------------------------------------
# Step 2: Create Target Group (port 3000)
# ------------------------------------------
echo ""
echo "Step 2: Creating Target Group..."
FE_TG_ARN=$(aws elbv2 create-target-group \
  --name cliniq-frontend-tg \
  --protocol HTTP \
  --port 3000 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path / \
  --health-check-interval-seconds 60 \
  --health-check-timeout-seconds 30 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 10 \
  --matcher HttpCode=200-499 \
  --region $REGION \
  --output text --query 'TargetGroups[0].TargetGroupArn' 2>/dev/null || \
  aws elbv2 describe-target-groups \
    --names cliniq-frontend-tg \
    --region $REGION \
    --output text --query 'TargetGroups[0].TargetGroupArn')

echo "Frontend Target Group ARN: $FE_TG_ARN"

# ------------------------------------------
# Step 3: Get existing ALB Listener
# ------------------------------------------
echo ""
echo "Step 3: Getting ALB Listener..."
LISTENER_ARN=$(aws elbv2 describe-listeners \
  --load-balancer-arn $ALB_ARN \
  --region $REGION \
  --output text --query 'Listeners[0].ListenerArn')

echo "Listener ARN: $LISTENER_ARN"

# ------------------------------------------
# Step 4: Add path-based routing rule
# Route /api/* to BE, everything else to FE
# ------------------------------------------
echo ""
echo "Step 4: Adding ALB routing rules..."

# Rule: /api/* → backend target group
BE_TG_ARN="arn:aws:elasticloadbalancing:us-east-1:719279823817:targetgroup/cliniq-tg/f663219b8088ba57"

# Get current default action (we'll change it to FE)
# First, add rule for /api/* to route to BE
aws elbv2 create-rule \
  --listener-arn $LISTENER_ARN \
  --priority 10 \
  --conditions '[{"Field":"path-pattern","Values":["/api/*"]}]' \
  --actions "[{\"Type\":\"forward\",\"TargetGroupArn\":\"$BE_TG_ARN\"}]" \
  --region $REGION 2>/dev/null || echo "Rule for /api/* may already exist"

# Change default action to forward to FE target group
aws elbv2 modify-listener \
  --listener-arn $LISTENER_ARN \
  --default-actions "[{\"Type\":\"forward\",\"TargetGroupArn\":\"$FE_TG_ARN\"}]" \
  --region $REGION

echo "ALB routing configured: /api/* → BE, default → FE"

# ------------------------------------------
# Step 5: Get Subnets and Security Group
# ------------------------------------------
echo ""
echo "Step 5: Getting network configuration..."
SUBNETS=$(aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --region $REGION \
  --output text --query 'Subnets[*].SubnetId' | tr '\t' ',')

SG=$(aws ec2 describe-security-groups \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=group-name,Values=*cliniq*" \
  --region $REGION \
  --output text --query 'SecurityGroups[0].GroupId')

echo "Subnets: $SUBNETS"
echo "Security Group: $SG"

# ------------------------------------------
# Step 6: Register Task Definition
# ------------------------------------------
echo ""
echo "Step 6: Registering Task Definition..."
aws ecs register-task-definition \
  --cli-input-json file://task-definition.json \
  --region $REGION

# ------------------------------------------
# Step 7: Create ECS Service
# ------------------------------------------
echo ""
echo "Step 7: Creating ECS Service..."
aws ecs create-service \
  --cluster $CLUSTER \
  --service-name cliniq-frontend-service \
  --task-definition cliniq-frontend \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SG],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=$FE_TG_ARN,containerName=cliniq-frontend,containerPort=3000" \
  --region $REGION

echo ""
echo "========================================="
echo "Frontend deployment complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Build & push Docker image:"
echo "   docker build --build-arg NEXT_PUBLIC_API_URL=$BE_API_URL -t $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/cliniq-frontend:latest ."
echo "   aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"
echo "   docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/cliniq-frontend:latest"
echo ""
echo "2. Force new deployment:"
echo "   aws ecs update-service --cluster $CLUSTER --service cliniq-frontend-service --force-new-deployment --region $REGION"
echo ""
echo "3. Add GitHub Secrets:"
echo "   - AWS_ACCESS_KEY_ID"
echo "   - AWS_SECRET_ACCESS_KEY"
echo "   - NEXT_PUBLIC_API_URL=$BE_API_URL"
echo ""
echo "4. Access frontend at: http://cliniq-alb-313587609.us-east-1.elb.amazonaws.com"
echo "========================================="
