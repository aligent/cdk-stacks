import * as cdk from '@aws-cdk/core';
import { expect as expectCDK, matchTemplate, MatchStyle, haveResource, haveResourceLike, countResources, objectLike, arrayWith, stringLike, notMatching } from '@aws-cdk/assert';
import { ServiceDeployIAM } from '../bin/app';


test('Creates a deploy role', () => {
     const app = new cdk.App();
     const stack = new ServiceDeployIAM(app, 'jest-deploy-iam');
     expectCDK(stack).to(countResources('AWS::IAM::Role', 1));
     expectCDK(stack).to(haveResource('AWS::IAM::Role', {
     }));
});


test('Creates a deploy user', () => {
     const app = new cdk.App();
     const stack = new ServiceDeployIAM(app, 'jest-deploy-iam');
     expectCDK(stack).to(countResources('AWS::IAM::User', 1));
     expectCDK(stack).to(haveResource('AWS::IAM::User'));
});

describe('Deploy user policy', () => {
     test('is created', () => {
          const app = new cdk.App();
          const stack = new ServiceDeployIAM(app, 'jest-deploy-iam');
          expectCDK(stack).to(haveResourceLike('AWS::IAM::Policy', {
               PolicyName: stringLike("jestdeployersDefaultPolicy*"),
          }));
     });
     test('has correct CloudFormation permissions', () => {
          const app = new cdk.App();
          const stack = new ServiceDeployIAM(app, 'jest-deploy-iam');
          expectCDK(stack).to(haveResourceLike('AWS::IAM::Policy', {
               PolicyName: stringLike("jestdeployersDefaultPolicy*"),
               PolicyDocument: {
                    Statement: arrayWith(

                         objectLike({
                              Action: "cloudformation:ValidateTemplate",
                              Effect: "Allow",
                              Resource: "*"
                         }),

                         objectLike({
                              Action: [
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
                              ],
                              Effect: "Allow",
                              Resource: [
                                   {
                                        "Fn::Join": [
                                             "",
                                             ["arn:aws:cloudformation:", { "Ref": "AWS::Region" }, ":", { "Ref": "AWS::AccountId" }, ":stack/jest*"],
                                        ],
                                   }, {
                                        "Fn::Join": [
                                             "",
                                             ["arn:aws:cloudformation:", { "Ref": "AWS::Region" }, ":", { "Ref": "AWS::AccountId" }, ":stack/", { "Ref": "cloudformationQualifier" }]
                                        ]
                                   }
                              ]
                         }),
                    )
               }
          }));
     });

     test('has correct Lambda permissions', () => {
          const app = new cdk.App();
          const stack = new ServiceDeployIAM(app, 'jest-deploy-iam');
          expectCDK(stack).to(haveResourceLike('AWS::IAM::Policy', {
               PolicyName: stringLike("jestdeployersDefaultPolicy*"),
               PolicyDocument: {
                    Statement: arrayWith(

                         objectLike({
                              Action: [
                                   "lambda:GetFunction",
                                   "lambda:InvokeFunction"
                              ],
                              Effect: "Allow",
                              Resource: [
                                   {
                                        "Fn::Join": [
                                             "",
                                             ["arn:aws:ssm:", { "Ref": "AWS::Region" }, ":", { "Ref": "AWS::AccountId" }, ":parameter/jest*"],
                                        ],
                                   }, {
                                        "Fn::Join": [
                                             "",
                                             ["arn:aws:ssm:", { "Ref": "AWS::Region" }, ":", { "Ref": "AWS::AccountId" }, ":parameter/", { "Ref": "lambdaQualifier" }]
                                        ]
                                   }
                              ]
                         }),
                    )
               }
          }));
     });
});


describe('CloudFormation service policy', () => {
     test('is created', () => {
          const app = new cdk.App();
          const stack = new ServiceDeployIAM(app, 'jest-deploy-iam');
          expectCDK(stack).to(haveResourceLike('AWS::IAM::Policy', {
               PolicyName: stringLike("ServiceRolev1DefaultPolicy*"),
          }));
     });

     test('has correct s3 permissions', () => {
          const app = new cdk.App();
          const stack = new ServiceDeployIAM(app, 'jest-deploy-iam');
          expectCDK(stack).to(haveResourceLike('AWS::IAM::Policy', {
               PolicyName: stringLike("ServiceRolev1DefaultPolicy*"),
               PolicyDocument: {
                    Statement: arrayWith(
                         objectLike(
                              {
                                   Action: "s3:*",
                                   Effect: "Allow",
                                   Resource: [
                                        "arn:aws:s3:::/jest*",
                                        "arn:aws:s3:::/jest*/*",
                                        {
                                             "Fn::Join": [
                                                  "",
                                                  [
                                                       "arn:aws:s3:::/",
                                                       {
                                                            "Ref": "s3Qualifier"
                                                       }
                                                  ]
                                             ]
                                        }
                                   ]
                              }),
                         objectLike({
                              Action: "s3:ListAllMyBuckets",
                              Effect: "Allow",
                              Resource: "*"
                         })
                    )
               }
          }));
     });
});

describe('Shared VPC', () => {
     test('when included adds additional EC2 service role policies', () => {
          const sharedVpcId = 'vpc-57e1b829'; // Random VPC id
          const app = new cdk.App();
          console.log('', app, 3)
          const stack = new ServiceDeployIAM(app, 'jest-deploy-iam', {
               
          });

          expectCDK(stack).to(haveResourceLike('AWS::IAM::Policy', {
               PolicyName: stringLike("*ServiceRolev1DefaultPolicy*"),
               PolicyDocument: {
                    Statement: arrayWith(
                         objectLike(
                              {
                                   Action: [
                                        "ec2:CreateSecurityGroup",
                                        "ec2:DescribeSecurityGroups",
                                        "ec2:DescribeSubnets",
                                        "ec2:DescribeVpcs",
                                        "ec2:createTags"
                                   ],
                                   Effect: "Allow",
                                   Resource: '*'
                              }),
                         objectLike(
                              {
                                   Action: "ec2:DeleteSecurityGroup",
                                   Condition: {
                                        "StringEquals": {
                                             "ec2:Vpc": {
                                                  "Fn::Join": [
                                                       "",
                                                       [
                                                            "arn:aws:ec2:",
                                                            {
                                                                 "Ref": "AWS::Region"
                                                            },
                                                            ":",
                                                            {
                                                                 "Ref": "AWS::AccountId"
                                                            },
                                                            `vpc:/${sharedVpcId}`
                                                       ]
                                                  ]
                                             }
                                        }
                                   },
                                   Effect: "Allow",
                                   Resource: "*"
                              })
                    )
               }
          }));
     });
});
