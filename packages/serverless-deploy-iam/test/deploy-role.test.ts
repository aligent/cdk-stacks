import * as cdk from "@aws-cdk/core";
import {
  expect as expectCDK,
  haveResource,
  haveResourceLike,
  countResources,
  objectLike,
  arrayWith,
  stringLike,
  notMatching,
} from "@aws-cdk/assert";
import { ServiceDeployIAM } from "../bin/app";

test("Creates a deploy role", () => {
  const app = new cdk.App();
  const stack = new ServiceDeployIAM(app, "jest-deploy-iam");
  expectCDK(stack).to(countResources("AWS::IAM::Role", 1));
  expectCDK(stack).to(haveResource("AWS::IAM::Role", {}));
});

test("Creates a deploy user", () => {
  const app = new cdk.App();
  const stack = new ServiceDeployIAM(app, "jest-deploy-iam");
  expectCDK(stack).to(countResources("AWS::IAM::User", 1));
  expectCDK(stack).to(haveResource("AWS::IAM::User"));
});

describe("Deploy user policy", () => {
  test("is created", () => {
    const app = new cdk.App();
    const stack = new ServiceDeployIAM(app, "jest-deploy-iam");
    expectCDK(stack).to(
      haveResourceLike("AWS::IAM::Policy", {
        PolicyName: stringLike("jestdeployersDefaultPolicy*"),
      })
    );
  });
  test("has correct CloudFormation permissions", () => {
    const app = new cdk.App();
    const stack = new ServiceDeployIAM(app, "jest-deploy-iam");
    expectCDK(stack).to(
      haveResourceLike("AWS::IAM::Policy", {
        PolicyName: stringLike("jestdeployersDefaultPolicy*"),
        PolicyDocument: {
          Statement: arrayWith(
            objectLike({
              Action: [
                "cloudformation:ValidateTemplate",
                "cloudformation:ListExports",
              ],
              Effect: "Allow",
              Resource: "*",
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
                "cloudformation:GetTemplate",
              ],
              Effect: "Allow",
              Resource: [
                {
                  "Fn::Join": [
                    "",
                    [
                      "arn:aws:cloudformation:",
                      { Ref: "AWS::Region" },
                      ":",
                      { Ref: "AWS::AccountId" },
                      ":stack/jest*",
                    ],
                  ],
                },
                {
                  "Fn::Join": [
                    "",
                    [
                      "arn:aws:cloudformation:",
                      { Ref: "AWS::Region" },
                      ":",
                      { Ref: "AWS::AccountId" },
                      ":stack/",
                      { Ref: "cloudformationQualifier" },
                    ],
                  ],
                },
              ],
            })
          ),
        },
      })
    );
  });

  test("has correct Lambda permissions", () => {
    const app = new cdk.App();
    const stack = new ServiceDeployIAM(app, "jest-deploy-iam");
    expectCDK(stack).to(
      haveResourceLike("AWS::IAM::Policy", {
        PolicyName: stringLike("jestdeployersDefaultPolicy*"),
        PolicyDocument: {
          Statement: arrayWith(
            objectLike({
              Action: ["lambda:GetFunction", "lambda:InvokeFunction"],
              Effect: "Allow",
              Resource: [
                {
                  "Fn::Join": [
                    "",
                    [
                      "arn:aws:lambda:",
                      { Ref: "AWS::Region" },
                      ":",
                      { Ref: "AWS::AccountId" },
                      ":function:jest*",
                    ],
                  ],
                },
                {
                  "Fn::Join": [
                    "",
                    [
                      "arn:aws:lambda:",
                      { Ref: "AWS::Region" },
                      ":",
                      { Ref: "AWS::AccountId" },
                      ":function:",
                      { Ref: "lambdaQualifier" },
                    ],
                  ],
                },
              ],
            })
          ),
        },
      })
    );
  });

  test("has correct CloudWatch permissions", () => {
    const app = new cdk.App();
    const stack = new ServiceDeployIAM(app, "jest-deploy-iam");
    expectCDK(stack).to(
      haveResourceLike("AWS::IAM::Policy", {
        PolicyName: stringLike("ServiceRolev1DefaultPolicy*"),
        PolicyDocument: {
          Statement: arrayWith(
            objectLike({
              Action: [
                "logs:CreateLogGroup",
                "logs:DescribeLogGroups",
                "logs:DeleteLogGroup",
                "logs:CreateLogStream",
                "logs:DescribeLogStreams",
                "logs:DeleteLogStream",
                "logs:FilterLogEvents",
                "logs:TagResource",
                "logs:UntagResource",
                "logs:DescribeMetricFilters",
                "logs:PutMetricFilter",
                "logs:ListTagsForResource",
                "logs:PutDataProtectionPolicy",
                "logs:UpdateDataProtectionPolicy",
              ],
              Effect: "Allow",
              Resource: [
                {
                  "Fn::Join": [
                    "",
                    [
                      "arn:aws:logs:",
                      { Ref: "AWS::Region" },
                      ":",
                      { Ref: "AWS::AccountId" },
                      ":log-group:/aws/lambda/jest*",
                    ],
                  ],
                },
                {
                  "Fn::Join": [
                    "",
                    [
                      "arn:aws:logs:",
                      { Ref: "AWS::Region" },
                      ":",
                      { Ref: "AWS::AccountId" },
                      ":log-group:/aws/apigateway/jest*",
                    ],
                  ],
                },
                {
                  "Fn::Join": [
                    "",
                    [
                      "arn:aws:logs:",
                      { Ref: "AWS::Region" },
                      ":",
                      { Ref: "AWS::AccountId" },
                      ":log-group:/aws/express/jest*",
                    ],
                  ],
                },
                {
                  "Fn::Join": [
                    "",
                    [
                      "arn:aws:logs:",
                      { Ref: "AWS::Region" },
                      ":",
                      { Ref: "AWS::AccountId" },
                      ":log-group:/aws/stepfunctions/jest*",
                    ],
                  ],
                },
                {
                  "Fn::Join": [
                    "",
                    [
                      "arn:aws:logs:",
                      { Ref: "AWS::Region" },
                      ":",
                      { Ref: "AWS::AccountId" },
                      ":log-group::log-stream:*",
                    ],
                  ],
                },
                {
                  "Fn::Join": [
                    "",
                    [
                      "arn:aws:logs:",
                      { Ref: "AWS::Region" },
                      ":",
                      { Ref: "AWS::AccountId" },
                      ":log-group:jest*",
                    ],
                  ],
                },
                {
                  "Fn::Join": [
                    "",
                    [
                      "arn:aws:logs:",
                      { Ref: "AWS::Region" },
                      ":",
                      { Ref: "AWS::AccountId" },
                      ":log-group:",
                      { Ref: "cloudwatchQualifier" },
                    ],
                  ],
                },
              ],
            })
          ),
        },
      })
    );
  });

  test("has correct permission to deploy CloudWatch alarms", () => {
    const app = new cdk.App();
    const stack = new ServiceDeployIAM(app, "jest-deploy-iam");
    expectCDK(stack).to(
      haveResourceLike("AWS::IAM::Policy", {
        PolicyName: stringLike("ServiceRolev1DefaultPolicy*"),
        PolicyDocument: {
          Statement: arrayWith(
            objectLike({
              Action: [
                "cloudwatch:ListMetrics",
                "cloudwatch:ListMetricStreams",
                "cloudwatch:ListTagsForResource",
                "cloudwatch:ListDashboards",
                "cloudwatch:DescribeAlarms",
                "cloudwatch:DeleteAlarms",
                "cloudwatch:EnableAlarmActions",
                "cloudwatch:PutMetricAlarm",
                "cloudwatch:PutDashboard",
                "cloudwatch:PutMetricData",
                "cloudwatch:PutMetricStream",
                "cloudwatch:SetAlarmState",
                "cloudwatch:TagResource",
                "cloudwatch:StartMetricStreams",
                "cloudwatch:StopMetricStreams",
              ],
              Effect: "Allow",
              Resource: [
                {
                  "Fn::Join": [
                    "",
                    [
                      "arn:aws:cloudwatch:",
                      { Ref: "AWS::Region" },
                      ":",
                      { Ref: "AWS::AccountId" },
                      ":alarm:TaskTimedOutAlarm",
                    ],
                  ],
                },
                {
                  "Fn::Join": [
                    "",
                    [
                      "arn:aws:cloudwatch:",
                      { Ref: "AWS::Region" },
                      ":",
                      { Ref: "AWS::AccountId" },
                      ":alarm:jest*",
                    ],
                  ],
                },
                {
                  "Fn::Join": [
                    "",
                    [
                      "arn:aws:cloudwatch:",
                      { Ref: "AWS::Region" },
                      ":",
                      { Ref: "AWS::AccountId" },
                      ":alarm:",
                      { Ref: "cloudwatchalarmsQualifier" },
                    ],
                  ],
                },
              ],
            })
          ),
        },
      })
    );
  });
});

describe("CloudFormation service policy", () => {
  test("is created", () => {
    const app = new cdk.App();
    const stack = new ServiceDeployIAM(app, "jest-deploy-iam");
    expectCDK(stack).to(
      haveResourceLike("AWS::IAM::Policy", {
        PolicyName: stringLike("ServiceRolev1DefaultPolicy*"),
      })
    );
  });

  test("has correct s3 permissions", () => {
    const app = new cdk.App();
    const stack = new ServiceDeployIAM(app, "jest-deploy-iam");
    expectCDK(stack).to(
      haveResourceLike("AWS::IAM::Policy", {
        PolicyName: stringLike("ServiceRolev1DefaultPolicy*"),
        PolicyDocument: {
          Statement: arrayWith(
            objectLike({
              Action: "s3:*",
              Effect: "Allow",
              Resource: [
                "arn:aws:s3:::jest*",
                "arn:aws:s3:::jest*/*",
                {
                  "Fn::Join": [
                    "",
                    [
                      "arn:aws:s3:::",
                      {
                        Ref: "s3Qualifier",
                      },
                    ],
                  ],
                },
              ],
            }),
            objectLike({
              Action: "s3:ListAllMyBuckets",
              Effect: "Allow",
              Resource: "*",
            })
          ),
        },
      })
    );
  });
});

describe("Shared VPC", () => {
  test("when not included it shouldn't add a additional EC2 service role policies", () => {
    const app = new cdk.App();
    const stack = new ServiceDeployIAM(app, "jest-deploy-iam");

    expectCDK(stack).to(
      haveResourceLike("AWS::IAM::Policy", {
        PolicyName: stringLike("*ServiceRolev1DefaultPolicy*"),
        PolicyDocument: {
          Statement: notMatching(
            arrayWith(
              objectLike({
                Action: [
                  "ec2:CreateSecurityGroup",
                  "ec2:DescribeSecurityGroups",
                  "ec2:DescribeSubnets",
                  "ec2:DescribeVpcs",
                  "ec2:createTags",
                ],
                Effect: "Allow",
                Resource: "*",
              })
            )
          ),
        },
      })
    );
  });
});
