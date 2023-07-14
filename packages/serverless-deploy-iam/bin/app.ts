#!/usr/bin/env node
import * as cdk from '@aws-cdk/core';
import * as ssm from '@aws-cdk/aws-ssm';
import {
     Role,
     ServicePrincipal,
     CompositePrincipal,
     PolicyStatement,
     Effect,
     Group,
     User,
     Conditions
} from '@aws-cdk/aws-iam';
import { CfnParameter } from '@aws-cdk/core';

interface Policy {
     name: string
     effect?: Effect
     actions?: string[]
     conditions?: Conditions
}

interface QualifierPolicy extends Policy {
     prefix: string
     qualifiers: string[]
     resources?: string[]
}

interface ResourcePolicy extends Policy {
     prefix?: string
     qualifiers?: string[]
     resources: string[]
}

interface PolicyStore {
     type: Group | Role
     policies: Array<ResourcePolicy | QualifierPolicy>
}

const SERVICE_NAME = process.env.SERVICE_NAME ? process.env.SERVICE_NAME : 'unknown-service'
const STACK_SUFFIX = '-deploy-iam'
const EXPORT_PREFIX = process.env.EXPORT_PREFIX ? process.env.EXPORT_PREFIX : SERVICE_NAME
const ENABLE_VPC_PERMISSIONS = process.env.ENABLE_VPC_PERMISSIONS === "1";
const PARAMETER_HASH = process.env.PARAMETER_HASH ? process.env.PARAMETER_HASH : '';
export class ServiceDeployIAM extends cdk.Stack {
     private policyStores: PolicyStore[];

     constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
          super(scope, id, props);

          // Version will be used for auditing which role is being used by projects.
          // This should only be updated for BREAKING changes.
          const version = '1'
          const serviceName = cdk.Stack.of(this).stackName.replace(STACK_SUFFIX, '');

          const sharedVPCParameter = new cdk.CfnParameter(this, `sharedVpcId`, {
               description: `Shared VPC ID`,
               default: ''
          });

          const accountId = cdk.Stack.of(this).account;
          const region = cdk.Stack.of(this).region;

          // CloudFormation doesn't detect a change when parameters are modified
          // This is due to CloudFormation linking parameters by reference
          // rather than injecting the parameter value.
          //
          // This dummy policy takes a hash of the parameters and uses it to create
          // a unique policy each time the parameters are modified. This way when
          // a parameter is altered, a change will be detected.
          const dummyPolicy : ResourcePolicy = {
               name: 'DUMMY',
               resources: [`arn:aws:iam::999999999999:group/${PARAMETER_HASH}`],
               actions: [
                    "iam:ListUsers"
               ]
          }

          const serviceRole: PolicyStore = {
               type: new Role(this, `ServiceRole-v${version}`, {
                    assumedBy: new CompositePrincipal(
                         new ServicePrincipal('cloudformation.amazonaws.com'),
                         new ServicePrincipal('lambda.amazonaws.com')
                    )
               }),
               policies: [
                    dummyPolicy,
                    {
                         name: 'S3',
                         prefix: `arn:aws:s3:::`,
                         qualifiers: [`${serviceName}*`, `${serviceName}*/*`],
                         actions: [
                              "s3:*"
                         ]
                    },
                    {
                         name: 'S3',
                         resources: ['*'],
                         actions: [
                              "s3:ListAllMyBuckets"
                         ]
                    },
                    {
                         name: 'CLOUD_WATCH',
                         prefix: `arn:aws:logs:${region}:${accountId}:log-group:`,
                         qualifiers: [
                              `/aws/lambda/${serviceName}*`, 
                              `/aws/apigateway/${serviceName}*`, 
                              `/aws/express/${serviceName}*`, 
                              `:log-stream:*`,
                              `${serviceName}*`
                         ],
                         actions: [
                              "logs:CreateLogGroup",
                              "logs:DescribeLogGroups",
                              "logs:DeleteLogGroup",
                              "logs:CreateLogStream",
                              "logs:DescribeLogStreams",
                              "logs:DeleteLogStream",
                              "logs:FilterLogEvents",
                              "logs:TagResource"
                         ]
                    },
                    {
                         name: 'LAMBDA',
                         prefix: `arn:aws:lambda:${region}:${accountId}:function:`,
                         qualifiers: [`${serviceName}*`],
                         actions: [
                              "lambda:GetFunction",
                              "lambda:CreateFunction",
                              "lambda:DeleteFunction",
                              "lambda:UpdateFunctionConfiguration",
                              "lambda:UpdateFunctionCode",
                              "lambda:ListVersionsByFunction",
                              "lambda:PublishVersion",
                              "lambda:CreateAlias",
                              "lambda:DeleteAlias",
                              "lambda:UpdateAlias",
                              "lambda:GetFunctionConfiguration",
                              "lambda:AddPermission",
                              "lambda:RemovePermission",
                              "lambda:InvokeFunction",
                              "lambda:ListTags",
                              "lambda:TagResource",
                              "lambda:PutFunctionConcurrency",
                              "lambda:DeleteEventSourceMapping",
                              "lambda:UpdateEventSourceMapping",
                              "lambda:CreateEventSourceMapping",
                              "lambda:DeleteFunctionUrlConfig",
                              "lambda:GetFunctionUrlConfig",
                              "lambda:ListFunctionUrlConfig",
                              "lambda:UpdateFunctionUrlConfig",
                         ]
                    },
                    {
                         name: 'LAMBDA',
                         resources: [`*`],
                         actions: [
                              "lambda:GetEventSourceMapping",
                              "lambda:ListEventSourceMappings"
                         ]
                    },
                    {
                         name: 'IAM',
                         prefix: `arn:aws:iam::${accountId}:user`,
                         qualifiers: [`${serviceName}*`],
                         actions: [
                              "iam:CreateUser",
                              "iam:PutUserPolicy",
                         ]
                    },
                    {
                         name: 'IAM',
                         prefix: `arn:aws:iam::${accountId}:role`,
                         qualifiers: [`${serviceName}*`],
                         actions: [
                              "iam:CreateRole",
                              "iam:PassRole",
                              "iam:GetRole",
                              "iam:DeleteRole",
                              "iam:GetRolePolicy",
                              "iam:DeleteRolePolicy",
                              "iam:PutRolePolicy",
                              "iam:DetachRolePolicy",
                              "iam:AttachRolePolicy",
                         ]
                    },
                    {
                         name: 'DYNAMO_DB',
                         prefix: `arn:aws:dynamodb:${region}:${accountId}:table`,
                         qualifiers: [`${serviceName}*`],
                         actions: [
                              "dynamodb:DescribeTable",
                              "dynamodb:CreateTable",
                              "dynamodb:UpdateTable",
                              "dynamodb:DeleteTable",
                         ]
                    },
                    {
                         name: 'STEP_FUNCTION',
                         prefix: `arn:aws:states:${region}:${accountId}:stateMachine:`,
                         qualifiers: [`${serviceName}*`],
                         actions: [
                              "states:CreateStateMachine",
                              "states:UpdateStateMachine",
                              "states:DeleteStateMachine",
                              "states:DescribeStateMachine",
                              "states:TagResource",
                         ]
                    },
                    {
                         name: 'EVENT_BRIDGE',
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
                              "events:TagResource"
                         ]
                    },
                    {
                         name: 'API_GATEWAY',
                         resources: [`*`],
                         actions: [
                              "apigateway:*",
                         ]
                    },
                    {
                         name: 'SNS',
                         prefix: `arn:aws:sns:${region}:${accountId}:`,
                         qualifiers: [`${serviceName}*`],
                         actions: [
                              "sns:GetTopicAttributes",
                              "sns:CreateTopic",
                              "sns:DeleteTopic",
                              "sns:Subscribe",
                              "sns:Unsubscribe",
                              "sns:ListSubscriptionsByTopic"
                         ]
                    },
                    {
                         name: 'SQS',
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
                              "sqs:ListDeadLetterSourceQueues",
                              "sqs:CreateQueue",
                         ]
                    }
               ]
          }

          if (ENABLE_VPC_PERMISSIONS) {
               serviceRole.policies = serviceRole.policies.concat([
                    {
                         name: 'EC2',
                         resources: [`*`],
                         actions: [
                              "ec2:CreateSecurityGroup",
                              "ec2:DescribeSecurityGroups",
                              "ec2:DescribeSubnets",
                              "ec2:DescribeVpcs",
                              "ec2:createTags"
                         ]
                    },
                    {
                         name: 'EC2',
                         resources: [`*`],
                         conditions: {
                              "StringEquals": {
                                   "ec2:Vpc": `arn:aws:ec2:${region}:${accountId}vpc:/${sharedVPCParameter.valueAsString}`
                              }
                         },
                         actions: [
                              "ec2:DeleteSecurityGroup"
                         ]
                    }
               ]);
          }

          const serviceGroup: PolicyStore = {
               type: new Group(this, `${serviceName}-deployers`),
               policies: [
                    dummyPolicy,
                    {
                         name: 'CLOUD_FORMATION',
                         prefix: `arn:aws:cloudformation:${region}:${accountId}:stack`,
                         qualifiers: [`${serviceName}*`],
                         actions: [
                              "cloudformation:CreateStack",
                              "cloudformation:DescribeStacks",
                              "cloudformation:DeleteStack",
                              "cloudformation:DescribeStackEvents",
                              "cloudformation:UpdateStack",
                              "cloudformation:ExecuteChangeSet",
                              "cloudformation:CreateChangeSet",
                              "cloudformation:DeleteChangeSet",
                              "cloudformation:DescribeChangeSet",
                              "cloudformation:ListStackResources",
                              "cloudformation:DescribeStackResource",
                              "cloudformation:DescribeStackResources",
                              "cloudformation:GetTemplate"
                         ]
                    },
                    {
                         name: 'CLOUD_FORMATION',
                         resources: [`*`],
                         actions: [
                              "cloudformation:ValidateTemplate",
                         ]
                    },
                    {
                         name: 'SSM',
                         resources: ['*'],
                         actions: [
                              "ssm:DescribeParameters"
                         ]
                    },
                    {
                         name: 'SSM',
                         prefix: `arn:aws:ssm:${region}:${accountId}:parameter`,
                         qualifiers: [`${serviceName}*`],
                         actions: [
                              "ssm:GetParameter"
                         ]
                    },
                    {
                         name: 'LAMBDA',
                         prefix: `arn:aws:lambda:${region}:${accountId}:function:`,
                         qualifiers: [`${serviceName}*`],
                         actions: [
                              "lambda:GetFunction",
                              "lambda:InvokeFunction"
                         ]
                    },
                    {
                         name: 'IAM',
                         resources: [(serviceRole.type as Role).roleArn],
                         actions: [
                              "iam:PassRole"
                         ]
                    },
                    {
                         name: 'S3',
                         prefix: `arn:aws:s3:::`,
                         qualifiers: [`${serviceName}*`, `${serviceName}*/*`],
                         actions: [
                              "s3:ListBucket",
                              "s3:DeleteObject",
                              "s3:PutObject",
                              "s3:GetObject",
                              "s3:GetBucketLocation"
                         ]
                    },
                    {
                         name: 'S3',
                         resources: ['*'],
                         actions: [
                              "s3:ListAllMyBuckets",
                         ]
                    },
                    // Deploy user must have permission to fetch API keys after the deploy
                    // Generated api key names are random so this cannot be limited to the service at this time
                    {
                         name: 'API_GATEWAY',
                         resources: [`arn:aws:apigateway:${region}::/apikeys/*`],
                         actions: [
                              "apigateway:GET",
                              "apigateway:PATCH",
                         ]
                    },
                    // The serverless-api-gateway-throttling requires PATCH access using the deploy user to update maxRequestsPerSecond and maxConcurrentRequests
                    {
                         name: 'API_GATEWAY',
                         resources: [`arn:aws:apigateway:${region}::/restapis/*/stages/*`],
                         actions: [
                              "apigateway:PATCH"
                         ]
                    }
               ]
          }

          this.policyStores = [
               serviceRole,
               serviceGroup
          ]

          const parameters = new Map<string, CfnParameter>();

          this.policyStores.forEach(store => {
               store.policies.forEach(policy => {
                    const parameterName = `${policy.name.toLowerCase()}Qualifier`;
                    if (!parameters.has(parameterName)) {
                         parameters.set(parameterName,
                              new CfnParameter(this, parameterName, {
                                   type: 'String',
                                   description: `Custom qualifier values provided for ${policy.name}`,
                                   default: ''
                              })
                         )
                    };

                    const qualifier = parameters.get(parameterName);

                    if (qualifier)
                         policy.qualifiers?.push(qualifier.valueAsString);

                    policy.resources = policy.resources || ServiceDeployIAM.formatResourceQualifier(policy.name, policy.prefix || '', policy.qualifiers || []);

                    store.type.addToPolicy(
                         new PolicyStatement(policy)
                    );

               });
          });

          const deployUser = new User(this, 'DeployUser', {
               userName: `${serviceName}-deployer`,
               groups: [
                    serviceGroup.type as Group
               ]
          });

          // Export CDK Output
          const export_prefix = !EXPORT_PREFIX.endsWith('-') ? EXPORT_PREFIX.concat("-") : EXPORT_PREFIX

          new cdk.CfnOutput(this, `${export_prefix}DeployUserName`, {
               description: 'PublisherUser',
               value: deployUser.userName,
               exportName: `${export_prefix}serverless-deployer-username`,
          });

          new cdk.CfnOutput(this, `${export_prefix}DeployRoleArn`, {
               value: (serviceRole.type as Role).roleArn,
               description: 'The ARN of the CloudFormation service role',
               exportName: `${export_prefix}serverless-deployer-role-arn`,
          });

          new cdk.CfnOutput(this, `${export_prefix}Version`, {
               value: version,
               description: 'The version of the resources that are currently provisioned in this stack',
               exportName: `${export_prefix}cdk-stack-version`,
          });

          new cdk.CfnOutput(this, `${export_prefix}ParameterHash`, {
               value: version,
               description: 'A hash of the parameter values provided.',
               exportName: `${export_prefix}parameter-hash`
          });

          const parameterName = `/serverless-deploy-iam/${serviceName}/version`;

          new ssm.StringParameter(this, 'ServerlessDeployIAMVersion', {
               parameterName: parameterName,
               description: 'The version of the serverless-deploy-iam resources',
               stringValue: version
          });
     }

     // Takes an array of qualifiers and prepends the prefix to each, returning the resulting array
     // Tests for injected resource qualifiers and adds these.
     // Also creates a parameter in CloudFormation
     static formatResourceQualifier(serviceName: string, prefix: string, qualifiers: string[]): string[] {
          let delimiter = "/";
          switch (serviceName) {
               case "CLOUD_WATCH":
               case "LAMBDA":
               case "S3":
               case "SNS":
               case "SQS":
               case "STEP_FUNCTION":
                    delimiter = "";
                    break;
               case "EVENT_BRIDGE":
                    delimiter = ":";
                    break;
          }

          return qualifiers.filter(Boolean).map((qualifier) => { return `${prefix}${delimiter}${qualifier}` })
     }
}

const app = new cdk.App();
new ServiceDeployIAM(app, `${SERVICE_NAME}${STACK_SUFFIX}`, { description: "This stack includes IAM resources needed to deploy Serverless apps into this environment" });

