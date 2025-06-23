#!/usr/bin/env node
import { App, Stack, StackProps } from "aws-cdk-lib";
import { Effect, Group, PolicyStatement, User } from "aws-cdk-lib/aws-iam";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

const EVENT_SOURCE = process.env.EVENT_SOURCE;
if (!EVENT_SOURCE) {
  throw Error("No EVENT_SOURCE defined");
}
const HYPHENATED_EVENT_SOURCE = EVENT_SOURCE.split(".").join("-");
export class EventBridgeIAM extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Version will be used for auditing which role is being used by projects.
    // This should only be updated for BREAKING changes.
    const version = "1";

    const eventbridgeUser = new User(
      this,
      `eventbridge-user-${HYPHENATED_EVENT_SOURCE}`,
      {
        userName: `eventbridge-user-${HYPHENATED_EVENT_SOURCE}`,
      }
    );

    const eventbridgeGroup = new Group(
      this,
      `eventbridge-users-${HYPHENATED_EVENT_SOURCE}`
    );

    eventbridgeGroup.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        resources: ["*"],
        actions: ["events:PutEvents"],
        conditions: {
          StringEquals: {
            "events:source": EVENT_SOURCE,
          },
        },
      })
    );

    eventbridgeUser.addToGroup(eventbridgeGroup);

    const parameterName = `/eventbridge-user/${HYPHENATED_EVENT_SOURCE}/version`;

    new StringParameter(this, "EventBridgeIAMVersion", {
      parameterName: parameterName,
      description: "The version of the eventbridge-iam resources",
      stringValue: version,
    });
  }
}

const app = new App();
new EventBridgeIAM(app, `eventbridge-iam-${HYPHENATED_EVENT_SOURCE}`, {
  description:
    "This stack provisions an IAM user with privilege to post events into the default EventBride",
});
