import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { ServiceDeployIAM } from "../bin/app";

const app = new App();
const stack = new ServiceDeployIAM(app, "jest-deploy-iam");
const template = Template.fromStack(stack);

test("Creates a deploy role", () => {
  template.hasResource("AWS::IAM::Role", {});
  template.resourceCountIs("AWS::IAM::Role", 1);
});

test("Creates a deploy user", () => {
  template.hasResource("AWS::IAM::User", {});
  template.resourceCountIs("AWS::IAM::User", 1);
});

describe("Deploy user policy", () => {
  test("is created", () => {
    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyName: Match.stringLikeRegexp("jestdeployersDefaultPolicy*"),
    });
  });
});

test("has correct CloudFormation permissions", () => {
  template.hasResourceProperties("AWS::IAM::Policy", {
    PolicyName: Match.stringLikeRegexp("jestdeployersDefaultPolicy*"),
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: "iam:ListUsers",
          Effect: "Allow",
          Resource: "arn:aws:iam::999999999999:group/",
        }),
        Match.objectLike({
          Action: "iam:CreateServiceLinkedRole",
          Effect: "Allow",
          Resource: Match.anyValue(),
        }),
        Match.objectLike({
          Action: [
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
        }),
        Match.objectLike({
          Action: "ssm:DescribeParameters",
          Effect: "Allow",
          Resource: "*",
        }),
      ]),
    },
  });
});

test("has correct Lambda permissions", () => {
  template.hasResourceProperties("AWS::IAM::Policy", {
    PolicyName: Match.stringLikeRegexp("jestdeployersDefaultPolicy*"),
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: [
            "lambda:GetFunction",
            "lambda:InvokeFunction",
            "lambda:ListTags",
          ],
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
        }),
      ]),
    },
  });
});

test("has correct CloudWatch logs permissions", () => {
  template.hasResourceProperties("AWS::IAM::Policy", {
    PolicyName: Match.stringLikeRegexp("ServiceRolev1DefaultPolicy*"),
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: "logs:*",
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
        }),
      ]),
    },
  });
});

test("has correct permission to deploy CloudWatch alarms", () => {
  template.hasResourceProperties("AWS::IAM::Policy", {
    PolicyName: Match.stringLikeRegexp("ServiceRolev1DefaultPolicy*"),
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: [
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
        }),
      ]),
    },
  });
});

describe("CloudFormation service policy", () => {
  test("is created", () => {
    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyName: Match.stringLikeRegexp("ServiceRolev1DefaultPolicy*"),
    });
  });
});

test("has correct s3 permissions", () => {
  template.hasResourceProperties("AWS::IAM::Policy", {
    PolicyName: Match.stringLikeRegexp("ServiceRolev1DefaultPolicy*"),
    PolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
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
        Match.objectLike({
          Action: "s3:ListAllMyBuckets",
          Effect: "Allow",
          Resource: "*",
        }),
      ]),
    },
  });
});

describe("Shared VPC", () => {
  test("when not included it shouldn't add a additional EC2 service role policies", () => {
    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyName: Match.stringLikeRegexp("ServiceRolev1DefaultPolicy*"),
      PolicyDocument: {
        Statement: Match.not(
          Match.arrayWith([
            Match.objectLike({
              Action: [
                "ec2:CreateSecurityGroup",
                "ec2:DescribeSecurityGroups",
                "ec2:DescribeSubnets",
                "ec2:DescribeVpcs",
                "ec2:createTags",
              ],
              Effect: "Allow",
              Resource: "*",
            }),
          ])
        ),
      },
    });
  });
});
