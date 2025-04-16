import { DynamoDBClient, QueryCommand, ScanCommand } from "@aws-sdk/client-dynamodb";
const client = new DynamoDBClient({region: 'us-east-1' });

const tableName = 'service-desk-member';

export const queryData = async (empId: string): Promise<Object> => {
  const paramsIns  = {
    TableName: tableName,
    KeyConditionExpression: "empId = :empId ",
    ExpressionAttributeValues: {
      ":empId": { S: empId },
    },
  };
  console.log('QueryCommand ',paramsIns);      
  const command = new QueryCommand(paramsIns);
  const response = await client.send(command);

  console.log('response', response);
  return response;
};

export const scanData = async (  scanKey1: string, scanValue1: string): Promise<Object> => {
  const paramsIns = {
    TableName: tableName,        
    ExpressionAttributeValues: {
      ':scanValue1' : {S: scanValue1},
    },
    ExpressionAttributeNames:{
      '#scanKey1' : scanKey1,
    },
    FilterExpression: '#scanKey1 = :scanValue1'
  };
  
  console.log('ScanCommand ',paramsIns);      
  const command = new ScanCommand(paramsIns);
  let response = await client.send(command);

  console.log('response', response);
  return response;
};


export const scanDataTwo = async (  scanKey1: string, scanValue1: string, scanKey2: string, scanValue2: string): Promise<Object> => {
  const paramsIns = {
    TableName: tableName,        
    ExpressionAttributeValues: {
      ':scanValue1' : {S: scanValue1},
      ':scanValue2' : {S: scanValue2},
    },
    ExpressionAttributeNames:{
      '#scanKey1' : scanKey1,
      '#scanKey2' : scanKey2,
    },
    FilterExpression: '#scanKey1 = :scanValue1 AND #scanKey2 = :scanValue2'
  };
  
  console.log('ScanCommand ',paramsIns);      
  const command = new ScanCommand(paramsIns);
  let response = await client.send(command);

  console.log('response', response);
  return response;
};

export const scanDataThree = async (  scanKey1: string, scanValue1: string, scanKey2: string, scanValue2: string, scanKey3: string, scanValue3: string): Promise<Object> => {
  const paramsIns = {
    TableName: tableName,        
    ExpressionAttributeValues: {
      ':scanValue1' : {S: scanValue1},
      ':scanValue2' : {S: scanValue2},
      ':scanValue3' : {S: scanValue3},
    },
    ExpressionAttributeNames:{
      '#scanKey1' : scanKey1,
      '#scanKey2' : scanKey2,
      '#scanKey3' : scanKey3,
    },
    FilterExpression: '#scanKey1 = :scanValue1 AND #scanKey2 = :scanValue2 AND #scanKey3 = :scanValue3'
  };
  
  console.log('ScanCommand ',paramsIns);      
  const command = new ScanCommand(paramsIns);
  let response = await client.send(command);

  console.log('response', response);
  return response;
};

export const scanDataFour = async (  
  scanKey1: string, scanValue1: string, 
  scanKey2: string, scanValue2: string, 
  scanKey3: string, scanValue3: string, 
  scanKey4: string, scanValue4: string
): Promise<Object> => {
  const paramsIns = {
    TableName: tableName,        
    ExpressionAttributeValues: {
      ':scanValue1' : {S: scanValue1},
      ':scanValue2' : {S: scanValue2},
      ':scanValue3' : {S: scanValue3},
      ':scanValue4' : {S: scanValue4},
    },
    ExpressionAttributeNames:{
      '#scanKey1' : scanKey1,
      '#scanKey2' : scanKey2,
      '#scanKey3' : scanKey3,
      '#scanKey4' : scanKey4,
    },
    FilterExpression: '#scanKey1 = :scanValue1 AND #scanKey2 = :scanValue2 AND #scanKey3 = :scanValue3 AND #scanKey4 = :scanValue4'
  };
  
  console.log('ScanCommand ',paramsIns);      
  const command = new ScanCommand(paramsIns);
  let response = await client.send(command);

  console.log('response', response);
  return response;
};
