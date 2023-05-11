# CDK Stack deploy IAM

## Introduction
This stack will provision an IAM user with permission to assume (pass in the case of cfn-execute) the account's [CDK Bootstrap](https://docs.aws.amazon.com/cdk/latest/guide/bootstrapping.html) roles. This user can then be used in deployment pipelines.

CD pipelines can then be setup with this user.


## Usage
This repository does not need to be forked, copied or imported. The intention is for it to be deployed *AS IS* into each environment for each service.
Additional permissions should be added to this stack and feature flagged rather than being added ad hoc to the environment.

### Parameters
The CDK stack requires the stack name to be provided as an environment variable.
This is the name of the CloudFormation stack which will be deployed.

### Custom Policy Statements
`Custom Policy Statements` extend the permission of the Stack deployment user.  
`Custom Policy Statements` can be passed as a set of JSON files.

#### Sample Policy Statement
```JSON
[
  {
    "Sid": "FirstStatement",
    "Effect": "Allow",
    "Action": "sts:AssumeRole",
    "Resource": "arn:aws:iam::166381158005:role/Read_Secret_Role"
  }
]
```

Use `CUSTOM_POLICY` environment variable to pass the JSON file(s) to the stack. *Comma seperated file paths are acceptable* 

### Deploying:
The intention is that this stack is deployed manually using the CDK CLI by an IAM user with admin privileges.
This should then be the last deployment into the environment from outside automated pipelines.

The actual CloudFormation stack can then be created and completely managed by the CD user via pipelines.

Use the following command to deploy this into an environment:

```shell
AWS_REGION=<AWS_REGION> STACK_NAME=<STACK_NAME> CUSTOM_POLICY=<JSON_FILES> npx cdk deploy --profile <AWS_PROFILE>
```
