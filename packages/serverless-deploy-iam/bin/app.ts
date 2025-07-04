#!/usr/bin/env node

import { App, CfnParameter, CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import {
  CompositePrincipal,
  Conditions,
  Effect,
  Group,
  PolicyStatement,
  Role,
  ServicePrincipal,
  User,
} from "aws-cdk-lib/aws-iam";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

interface Policy {
  name: string;
  effect?: Effect;
  actions?: string[];
  conditions?: Conditions;
}

interface QualifierPolicy extends Policy {
  prefix: string;
  qualifiers: string[];
  resources?: string[];
}

interface ResourcePolicy extends Policy {
  prefix?: string;
  qualifiers?: string[];
  resources: string[];
}

interface PolicyStore {
  type: Group | Role;
  policies: Array<ResourcePolicy | QualifierPolicy>;
}

const SERVICE_NAME = process.env.SERVICE_NAME
  ? process.env.SERVICE_NAME
  : "unknown-service";
const STACK_SUFFIX = "-deploy-iam";
const EXPORT_PREFIX = process.env.EXPORT_PREFIX
  ? process.env.EXPORT_PREFIX
  : SERVICE_NAME;
const ENABLE_VPC_PERMISSIONS = process.env.ENABLE_VPC_PERMISSIONS === "1";
const PARAMETER_HASH = process.env.PARAMETER_HASH
  ? process.env.PARAMETER_HASH
  : "";
export class ServiceDeployIAM extends Stack {
  private policyStores: PolicyStore[];

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Version will be used for auditing which role is being used by projects.
    // This should only be updated for BREAKING changes.
    const version = "1";
    const serviceName = Stack.of(this).stackName.replace(STACK_SUFFIX, "");

    const sharedVPCParameter = new CfnParameter(this, `sharedVpcId`, {
      description: `Shared VPC ID`,
      default: "",
    });

    const accountId = Stack.of(this).account;
    const region = Stack.of(this).region;

    // CloudFormation doesn't detect a change when parameters are modified
    // This is due to CloudFormation linking parameters by reference
    // rather than injecting the parameter value.
    //
    // This dummy policy takes a hash of the parameters and uses it to create
    // a unique policy each time the parameters are modified. This way when
    // a parameter is altered, a change will be detected.
    const dummyPolicy: ResourcePolicy = {
      name: "DUMMY",
      resources: [`arn:aws:iam::999999999999:group/${PARAMETER_HASH}`],
      actions: ["iam:ListUsers"],
    };

    const serviceRole: PolicyStore = {
      type: new Role(this, `ServiceRole-v${version}`, {
        assumedBy: new CompositePrincipal(
          new ServicePrincipal("cloudformation.amazonaws.com"),
          new ServicePrincipal("lambda.amazonaws.com")
        ),
      }),
      policies: [
        dummyPolicy,
        {
          name: "S3",
          prefix: `arn:aws:s3:::`,
          qualifiers: [`${serviceName}*`, `${serviceName}*/*`],
          actions: ["s3:*"],
        },
        {
          name: "S3",
          resources: ["*"],
          actions: ["s3:ListAllMyBuckets"],
        },
        {
          name: "CLOUD_WATCH",
          prefix: `arn:aws:logs:${region}:${accountId}:log-group:`,
          qualifiers: [
            `/aws/lambda/${serviceName}*`,
            `/aws/apigateway/${serviceName}*`,
            `/aws/express/${serviceName}*`,
            `/aws/stepfunctions/${serviceName}*`,
            `:log-stream:*`,
            `${serviceName}*`,
          ],
          actions: ["logs:*"],
        },
        {
          name: "CLOUD_WATCH",
          resources: ["*"],
          actions: ["logs:DeleteDataProtectionPolicy"],
        },
        {
          name: "CLOUD_WATCH_ALARMS",
          prefix: `arn:aws:cloudwatch:${region}:${accountId}:alarm:`,
          qualifiers: [`TaskTimedOutAlarm`, `${serviceName}*`],
          actions: [
            "cloudwatch:List*",
            "cloudwatch:DescribeAlarms",
            "cloudwatch:DeleteAlarms",
            "cloudwatch:EnableAlarmActions",
            "cloudwatch:Put*",
            "cloudwatch:SetAlarmState",
            "cloudwatch:TagResource",
            "cloudwatch:StartMetricStreams",
            "cloudwatch:StopMetricStreams",
          ],
        },
        {
          name: "LAMBDA",
          prefix: `arn:aws:lambda:${region}:${accountId}:function:`,
          qualifiers: [`${serviceName}*`],
          actions: ["lambda:*"],
        },
        {
          name: "LAMBDA_EVENT_SOURCE_MAPPING",
          resources: [
            `arn:aws:lambda:${region}:${accountId}:event-source-mapping:*`,
          ],
          actions: [
            "lambda:TagResource",
            "lambda:UntagResource",
            "lambda:GetEventSourceMapping",
            "lambda:ListEventSourceMappings",
            "lambda:CreateEventSourceMapping",
            "lambda:DeleteEventSourceMapping",
          ],
        },
        {
          name: "IAM",
          prefix: `arn:aws:iam::${accountId}:user`,
          qualifiers: [`${serviceName}*`],
          actions: ["iam:CreateUser", "iam:PutUserPolicy"],
        },
        {
          name: "IAM",
          prefix: `arn:aws:iam::${accountId}:role`,
          qualifiers: [`${serviceName}*`, `Cognito-${serviceName}*`],
          actions: [
            "iam:CreateRole",
            "iam:PassRole",
            "iam:GetRole",
            "iam:DeleteRole",
            "iam:UpdateRole",
            "iam:TagRole",
            "iam:GetRolePolicy",
            "iam:DeleteRolePolicy",
            "iam:PutRolePolicy",
            "iam:DetachRolePolicy",
            "iam:AttachRolePolicy",
            "iam:UpdateAssumeRolePolicy",
            "iam:TagRole",
            "iam:UntagRole",
          ],
        },
        {
          name: "DYNAMO_DB",
          prefix: `arn:aws:dynamodb:${region}:${accountId}:table`,
          qualifiers: [`${serviceName}*`],
          actions: [
            "dynamodb:DescribeTable",
            "dynamodb:CreateTable",
            "dynamodb:UpdateTable",
            "dynamodb:DeleteTable",
            "dynamodb:ListTagsOfResource",
            "dynamodb:TagResource",
            "dynamodb:UntagResource",
            "dynamodb:*TimeToLive",
          ],
        },
        {
          name: "STEP_FUNCTION",
          prefix: `arn:aws:states:${region}:${accountId}:stateMachine:`,
          qualifiers: [`${serviceName}*`],
          actions: [
            "states:CreateStateMachine",
            "states:UpdateStateMachine",
            "states:DeleteStateMachine",
            "states:DescribeStateMachine",
            "states:TagResource",
            "states:UntagResource",
          ],
        },
        {
          name: "EVENT_BRIDGE",
          prefix: `arn:aws:events:${region}:${accountId}`,
          qualifiers: [`rule/${serviceName}*`, `event-bus/${serviceName}*`],
          actions: [
            "events:EnableRule",
            "events:PutRule",
            "events:DescribeRule",
            "events:ListRules",
            "events:DisableRule",
            "events:PutTargets",
            "events:RemoveTargets",
            "events:DeleteRule",
            "events:CreateEventBus",
            "events:DescribeEventBus",
            "events:DeleteEventBus",
            "events:TagResource",
            "events:UntagResource",
          ],
        },
        {
          name: "SCHEDULER",
          prefix: `arn:aws:scheduler:${region}:${accountId}:schedule/default`,
          qualifiers: [`${serviceName}*`],
          actions: [
            "scheduler:GetSchedule",
            "scheduler:CreateSchedule",
            "scheduler:UpdateSchedule",
            "scheduler:DeleteSchedule",
          ],
        },
        {
          name: "SCHEDULEGROUP",
          prefix: `arn:aws:scheduler:${region}:${accountId}:schedule-group`,
          qualifiers: [`${serviceName}*`],
          actions: [
            "scheduler:GetScheduleGroup",
            "scheduler:CreateScheduleGroup",
            "scheduler:DeleteScheduleGroup",
            "scheduler:TagResource",
            "scheduler:ListTagsForResource",
          ],
        },
        {
          name: "API_GATEWAY",
          resources: [`*`],
          actions: ["apigateway:*"],
        },
        {
          name: "SNS",
          prefix: `arn:aws:sns:${region}:${accountId}:`,
          qualifiers: [`${serviceName}*`],
          actions: [
            "sns:GetTopicAttributes",
            "sns:SetTopicAttributes",
            "sns:CreateTopic",
            "sns:DeleteTopic",
            "sns:Subscribe",
            "sns:Unsubscribe",
            "sns:ListSubscriptionsByTopic",
            "sns:TagResource",
          ],
        },
        {
          name: "SQS",
          prefix: `arn:aws:sqs:${region}:${accountId}:`,
          qualifiers: [`${serviceName}*`],
          actions: [
            "sqs:UntagQueue",
            "sqs:RemovePermission",
            "sqs:GetQueueUrl",
            "sqs:GetQueueAttributes",
            "sqs:AddPermission",
            "sqs:DeleteQueue",
            "sqs:ListQueueTags",
            "sqs:SetQueueAttributes",
            "sqs:ChangeMessageVisibility",
            "sqs:TagQueue",
            "sqs:UntagQueue",
            "sqs:ListDeadLetterSourceQueues",
            "sqs:CreateQueue",
          ],
        },
        {
          name: "COGNITO",
          prefix: `arn:aws:cognito-sync:${region}:${accountId}:identitypool`,
          qualifiers: [`${serviceName}*`],
          actions: [
            "cognito-sync:BulkPublish",
            "cognito-sync:DeleteDataset",
            "cognito-sync:Describe*",
            "cognito-sync:Get*",
            "cognito-sync:List*",
            "cognito-sync:QueryRecords",
            "cognito-sync:RegisterDevice",
            "cognito-sync:SetCognitoEvents",
            "cognito-sync:SetDatasetConfiguration",
            "cognito-sync:SetIdentityPoolConfiguration",
            "cognito-sync:SubscribeToDataset",
            "cognito-sync:UnsubscribeFromDataset",
            "cognito-sync:UpdateRecords",
            "cognito-identity:CreateIdentityPool",
            "cognito-identity:DeleteIdentities",
            "cognito-identity:DeleteIdentityPool",
            "cognito-identity:Describe*",
            "cognito-identity:Get*",
            "cognito-identity:List*",
            "cognito-identity:LookupDeveloperIdentity",
            "cognito-identity:MergeDeveloperIdentities",
            "cognito-identity:SetIdentityPoolRoles",
            "cognito-identity:SetPrincipalTagAttributeMap",
            "cognito-identity:TagResource",
            "cognito-identity:UnlinkDeveloperIdentity",
            "cognito-identity:UnlinkIdentity",
            "cognito-identity:UntagResource",
            "cognito-identity:UpdateIdentityPool",
          ],
        },
        {
          name: "COGNITO_IDP",
          prefix: `arn:aws:cognito-idp:${region}:${accountId}:userpool`,
          qualifiers: [`${serviceName}*`, `${region}_*`],
          actions: ["cognito-idp:*"],
        },
        {
          name: "COGNITO_IDP_CREATEUSERPOOL",
          prefix: `arn:aws:cognito-idp:${region}:${accountId}:userpool`,
          qualifiers: ["*"],
          actions: ["cognito-idp:CreateUserPool"],
        },
        {
          name: "COGNITO_IDP_IDENTITYPOOL",
          prefix: `arn:aws:cognito-identity:${region}:${accountId}:identitypool`,
          qualifiers: [`${region}:*`],
          actions: [
            "cognito-identity:CreateIdentityPool",
            "cognito-identity:SetIdentityPoolRoles",
          ],
        },
        {
          name: "CLOUDFRONT-OAI",
          resources: [
            `arn:aws:cloudfront::${accountId}:origin-access-identity/*`,
          ],
          actions: [
            "cloudfront:CreateCloudFrontOriginAccessIdentity",
            "cloudfront:GetCloudFrontOriginAccessIdentity",
            "cloudfront:DeleteCloudFrontOriginAccessIdentity",
          ],
        },
        {
          name: "CLOUDFRONT-FUNCTION",
          resources: [`arn:aws:cloudfront::${accountId}:function/*`],
          actions: ["cloudfront:CreateFunction"],
        },
        {
          name: "CLOUDFRONT-FUNCTION",
          resources: [
            `arn:aws:cloudfront::${accountId}:function/${serviceName}*`,
          ],
          actions: [
            "cloudfront:CreateFunction",
            "cloudfront:DescribeFunction",
            "cloudfront:DeleteFunction",
            "cloudfront:PublishFunction",
            "cloudfront:GetFunction",
          ],
        },
        {
          name: "CLOUDFRONT-DISTRIBUTION",
          resources: [`arn:aws:cloudfront::${accountId}:distribution/*`],
          actions: [
            "cloudfront:CreateDistribution",
            "cloudfront:DeleteDistribution",
            "cloudfront:GetDistribution",
            "cloudfront:ListDistributions",
            "cloudfront:UpdateDistribution",
            "cloudfront:TagResource",
          ],
        },
        {
          name: "KMS",
          resources: [`arn:aws:kms:${region}:${accountId}:key/*`],
          actions: [
            "kms:CreateKey",
            "kms:DescribeKey",
            "kms:DisableKey",
            "kms:EnableKey",
            "kms:Encrypt",
            "kms:Generate*",
            "kms:GetKeyPolicy",
            "kms:GetPublicKey",
            "kms:ListKeys",
            "kms:ListResourceTags",
            "kms:PutKeyPolicy",
            "kms:ScheduleKeyDeletion",
            "kms:Sign",
            "kms:TagResource",
            "kms:UntagResource",
          ],
        },
      ],
    };

    if (ENABLE_VPC_PERMISSIONS) {
      serviceRole.policies = serviceRole.policies.concat([
        {
          name: "EC2",
          resources: [`*`],
          actions: [
            "ec2:CreateSecurityGroup",
            "ec2:DescribeSecurityGroups",
            "ec2:DescribeSubnets",
            "ec2:DescribeVpcs",
            "ec2:createTags",
          ],
        },
        {
          name: "EC2",
          resources: [`*`],
          conditions: {
            StringEquals: {
              "ec2:Vpc": `arn:aws:ec2:${region}:${accountId}vpc:/${sharedVPCParameter.valueAsString}`,
            },
          },
          actions: ["ec2:DeleteSecurityGroup"],
        },
      ]);
    }

    const serviceGroup: PolicyStore = {
      type: new Group(this, `${serviceName}-deployers`),
      policies: [
        dummyPolicy,
        {
          name: "SERVICE_LINKED_ROLE",
          actions: ["iam:CreateServiceLinkedRole"],
          resources: [
            `arn:aws:iam::${accountId}:role/aws-service-role/ops.apigateway.amazonaws.com/AWSServiceRoleForAPIGateway`,
          ],
          effect: Effect.ALLOW,
        },
        {
          name: "CLOUD_FORMATION",
          prefix: `arn:aws:cloudformation:${region}:${accountId}:stack`,
          qualifiers: [`${serviceName}*`],
          actions: [
            "cloudformation:CreateStack",
            "cloudformation:Describe*",
            "cloudformation:List*",
            "cloudformation:Get*",
            "cloudformation:DeleteStack",
            "cloudformation:UpdateStack",
            "cloudformation:ExecuteChangeSet",
            "cloudformation:CreateChangeSet",
            "cloudformation:DeleteChangeSet",
          ],
        },
        {
          name: "CLOUD_FORMATION",
          resources: [`*`],
          actions: [
            "cloudformation:ValidateTemplate",
            "cloudformation:ListExports",
          ],
        },
        {
          name: "SSM",
          resources: ["*"],
          actions: ["ssm:DescribeParameters"],
        },
        {
          name: "SSM",
          prefix: `arn:aws:ssm:${region}:${accountId}:parameter`,
          qualifiers: [`${serviceName}*`],
          actions: ["ssm:GetParameter"],
        },
        {
          name: "LAMBDA",
          prefix: `arn:aws:lambda:${region}:${accountId}:function:`,
          qualifiers: [`${serviceName}*`],
          actions: [
            "lambda:GetFunction",
            "lambda:InvokeFunction",
            "lambda:ListTags",
          ],
        },
        {
          name: "IAM",
          resources: [(serviceRole.type as Role).roleArn],
          actions: ["iam:PassRole"],
        },
        {
          name: "IAM",
          prefix: `arn:aws:iam::${accountId}:role`,
          qualifiers: [
            "aws-service-role/ops.apigateway.amazonaws.com/AWSServiceRoleForAPIGateway",
          ],
          actions: ["iam:CreateServiceLinkedRole"],
        },
        {
          name: "S3",
          prefix: `arn:aws:s3:::`,
          qualifiers: [`${serviceName}*`, `${serviceName}*/*`],
          actions: [
            "s3:CreateBucket",
            "s3:ListBucket",
            "s3:DeleteObject",
            "s3:PutObject",
            "s3:GetObject",
            "s3:GetBucketLocation",
          ],
        },
        {
          name: "S3",
          resources: ["*"],
          actions: ["s3:ListAllMyBuckets"],
        },
        // Deploy user must have permission to fetch API keys after the deploy
        // Generated api key names are random so this cannot be limited to the service at this time
        {
          name: "API_GATEWAY",
          resources: [`arn:aws:apigateway:${region}::*`],
          actions: ["apigateway:GET", "apigateway:PATCH", "apigateway:POST"],
        },
        {
          name: "DISTRIBUTION",
          resources: [`arn:aws:cloudfront::${accountId}:distribution/*`],
          actions: ["cloudfront:CreateInvalidation"],
        },
      ],
    };

    this.policyStores = [serviceRole, serviceGroup];

    const parameters = new Map<string, CfnParameter>();

    this.policyStores.forEach(store => {
      store.policies.forEach(policy => {
        const parameterName = `${policy.name.toLowerCase()}Qualifier`;
        if (!parameters.has(parameterName)) {
          parameters.set(
            parameterName,
            new CfnParameter(this, parameterName, {
              type: "String",
              description: `Custom qualifier values provided for ${policy.name}`,
              default: PARAMETER_HASH,
            })
          );
        }

        const qualifier = parameters.get(parameterName);

        if (qualifier) policy.qualifiers?.push(qualifier.valueAsString);

        policy.resources =
          policy.resources ||
          ServiceDeployIAM.formatResourceQualifier(
            policy.name,
            policy.prefix || "",
            policy.qualifiers || []
          );

        store.type.addToPolicy(new PolicyStatement(policy));
      });
    });

    const deployUser = new User(this, "DeployUser", {
      userName: `${serviceName}-deployer`,
      groups: [serviceGroup.type as Group],
    });

    // Export CDK Output
    const export_prefix = !EXPORT_PREFIX.endsWith("-")
      ? EXPORT_PREFIX.concat("-")
      : EXPORT_PREFIX;

    new CfnOutput(this, `${export_prefix}DeployUserName`, {
      description: "PublisherUser",
      value: deployUser.userName,
      exportName: `${export_prefix}serverless-deployer-username`,
    });

    new CfnOutput(this, `${export_prefix}DeployRoleArn`, {
      value: (serviceRole.type as Role).roleArn,
      description: "The ARN of the CloudFormation service role",
      exportName: `${export_prefix}serverless-deployer-role-arn`,
    });

    new CfnOutput(this, `${export_prefix}Version`, {
      value: version,
      description:
        "The version of the resources that are currently provisioned in this stack",
      exportName: `${export_prefix}cdk-stack-version`,
    });

    new CfnOutput(this, `${export_prefix}ParameterHash`, {
      value: version,
      description: "A hash of the parameter values provided.",
      exportName: `${export_prefix}parameter-hash`,
    });

    const parameterName = `/serverless-deploy-iam/${serviceName}/version`;

    new StringParameter(this, "ServerlessDeployIAMVersion", {
      parameterName: parameterName,
      description: "The version of the serverless-deploy-iam resources",
      stringValue: version,
    });
  }

  // Takes an array of qualifiers and prepends the prefix to each, returning the resulting array
  // Tests for injected resource qualifiers and adds these.
  // Also creates a parameter in CloudFormation
  static formatResourceQualifier(
    serviceName: string,
    prefix: string,
    qualifiers: string[]
  ): string[] {
    let delimiter = "/";
    switch (serviceName) {
      case "COGNITO":
      case "CLOUD_WATCH":
      case "CLOUD_WATCH_ALARMS":
      case "LAMBDA":
      case "S3":
      case "SNS":
      case "SQS":
      case "STEP_FUNCTION":
        delimiter = "";
        break;
      case "API_GATEWAY":
      case "API_GATEWAY_RESTAPIS":
        delimiter = "";
        break;
      case "EVENT_BRIDGE":
        delimiter = ":";
        break;
    }

    return qualifiers.filter(Boolean).map(qualifier => {
      return `${prefix}${delimiter}${qualifier}`;
    });
  }
}

const app = new App();
new ServiceDeployIAM(app, `${SERVICE_NAME}${STACK_SUFFIX}`, {
  description:
    "This stack includes IAM resources needed to deploy Serverless apps into this environment",
});
