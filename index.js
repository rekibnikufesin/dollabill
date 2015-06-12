#! /usr/bin/env node
'use strict';

//  Initial thoughts:
// gather all the instances, and associate the volumes with them
// then get the utilization
// associate costs (instance + volumes)
// log out: instance + utilization + cost

var AWS = require('aws-sdk');
var async = require('async');
var Table = require('cli-table');

var instances = [];
var cloudwatch = new AWS.CloudWatch({region: 'us-east-1'});
var output = 'tab';

async.series([
  function(callback){
    // gather instance name, id, size and volumes
    new AWS.EC2({region: 'us-east-1'}).describeInstances(function(error, data) {
      if (error) {
        console.log(error); // an error occurred
      } else {
        //console.log(data); // request succeeded
        async.each(data.Reservations, function(d, resCB){
          async.each(d.Instances, function(i, instCB){
            var name = 'None found';
            var volIds = [];
            async.each(i.Tags,(function(t, tCB){
              if(t.Key === 'Name') { name = t.Value }
              tCB();
            }));
            async.each(i.BlockDeviceMappings, function(b, bCB){
              volIds.push(b.Ebs.VolumeId);
              bCB();
            });
            instances.push({name: name, id: i.InstanceId, size: i.InstanceType, vols: volIds});
            instCB();
          }, function(){
            resCB();
          });
        }, function(){
          callback();
        });
        //console.log(instances);
      }
    });
  },
  function(callback){
    // get volume sizes and attach to instance
    async.each(instances, function(i, iCB){
      var vParam = { VolumeIds: i.vols };
      var vSize = 0;
      var request = new AWS.EC2({region: 'us-east-1'}).describeVolumes(vParam);
      request.
        on('success', function(response){
          //console.log(response.data)
          if(response.data.Volumes){
            var totalDisk = 0;
            async.each(response.data.Volumes, function(v, vCB){
              totalDisk += v.Size;
              vCB();
            }, function(){
              i.totalDisk = totalDisk;
            })
          }
        }).
        on('error', function(response){
          i.totalDisk = 0;
          console.log(response)
        }).
        on('complete', function(response){
          //console.log('complete response');
          iCB();
        }).
        send();
      //iCB();
    }, function(){
      //console.log(instances);
      callback();
    });
  },
  function(callback){
    // calculate utilization per instance
    async.each(instances, function(c, cCB){
    //  console.log('calculating...');
      var cParam = {
        EndTime: new Date(), /* required */
        MetricName: 'CPUUtilization', /* required */
        Namespace: 'AWS/EC2', /* required */
        Period: 900, /* required (15 minute block) */
        StartTime: new Date('June 01, 2015 00:00:00'), /* required */
        Statistics: [ /* required */
          'Average'
        ],
        Dimensions: [
          {
            Name: 'InstanceId', /* required */
            Value: c.id /* required */
          }
        ]
      };
      var request = cloudwatch.getMetricStatistics(cParam);
      var avgUtilization;
      request.
        on('success', function(response){
          if(response.data.Datapoints && response.data.Datapoints.length > 0){
            var tmpUtil = 0;
            async.each(response.data.Datapoints, function(u, uCB){
              tmpUtil += u.Average;
              uCB();
            }, function(){
              c.utilization = tmpUtil / response.data.Datapoints.length;
            })
          } else {
            c.utilization = 'No data';
          }
        }).
        on('error', function(response){
          console.log(response)
        }).
        on('complete', function(response){
          cCB();
        }).
        send();
    }, function(){
      callback();
    })
  },
  function(callback){
    // calculate the average monthly cost
    async.each(instances, function(i, iCB){
      i.diskCost = parseInt(i.totalDisk) * .1;
      switch(i.size){
        case "t2.micro":
          // $0.013/hour, $2.19/month
          i.monthly = 24 * 30 * .013;
          i.reserved = 2.19;
          break;
        case "t2.small":
          // $0.026/hour, $4.38/month
          i.monthly = 24 * 30 * .026;
          i.reserved = 4.38;
          break;
        case "t2.medium":
          // $0.052/hour, $8.76/month
          i.monthly = 24 * 30 * .052;
          i.reserved = 8.76;
          break;
        case "m4.large":
          // $0.126/hour, $27.01/month
          i.monthly = 24 * 30 * .126;
          i.reserved = 27.01;
          break;
        case "m4.xlarge":
          // $0.252/hour, $54.02/month
          i.monthly = 24 * 30 * .252;
          i.reserved = 54.02;
          break;
        case "m4.2xlarge":
          // $0.504/hour, $108.04/month
          i.monthly = 24 * 30 * .504;
          i.reserved = 108.04;
          break;
        case "m4.4xlarge":
          // $1.008/hour, $216.08/month
          i.monthly = 24 * 30 * 1.008;
          i.reserved = 216.08;
          break;
        case "m4.10xlarge":
          // $2.52/hour, $540.20/month
          i.monthly = 24 * 30 * 2.52;
          i.reserved = 540.20;
          break;
        case "m3.medium":
          // $0.067/hour, $12.41/month
          i.monthly = 24 * 30 * .067;
          i.reserved = 12.41;
          break;
        case "m3.large":
          // $0.133/hour, $25.55/month
          i.monthly = 24 * 30 * .133;
          i.reserved = 25.55;
          break;
        case "m3.xlarge":
          // $0.266/hour, $51.10/month
          i.monthly = 24 * 30 * .266;
          i.reserved = 51.10;
          break;
        case "m3.2xlarge":
          // $0.532/hour, $101.46/month
          i.monthly = 24 * 30 * .532;
          i.reserved = 101.46;
          break;
        case "t1.micro":
          // $0.020/hour, $3.65/month
          i.monthly = 24 * 30 * .020;
          i.reserved = 3.65;
          break;
        case "m1.small":
          // $0.044/hour, $7.30/month
          i.monthly = 24 * 30 * .044;
          i.reserved = 7.30;
          break;
        case "m1.medium":
          // $0.087/hour, $14.60/month
          i.monthly = 24 * 30 * .087;
          i.reserved = 14.60;
          break;
        case "m1.large":
          // $0.175/hour, $29.93/month
          i.monthly = 24 * 30 * .175;
          i.reserved = 29.93;
          break;
        case "m1.xlarge":
          // $0.350/hour, $59.86/month
          i.monthly = 24 * 30 * .350;
          i.reserved = 59.86;
          break;
        case "c3.4xlarge":
          // $0.84/hour, $152.57/month
          i.monthly = 24 * 30 * .84;
          i.reserved = 152.57;
          break;
        case "c3.2xlarge":
          // $0.42/hour, $75.92/month
          i.monthly = 24 * 30 * .42;
          i.reserved = 75.92;
          break;
        case "c4.2xlarge":
          // $0.441/hour, $102.93/month
          i.monthly = 24 * 30 * .441;
          i.reserved = 102.93;
          break;
        case "c4.4xlarge":
          // $0.882/hour, $205.13/month
          i.monthly = 24 * 30 * .882;
          i.reserved = 205.13;
          break;
        default:
          i.monthly = "Missing data";
      }
      iCB();
    }, function(){
      callback();
    })
  }
], function(){
  //console.log(instances);
  if(output === 'tab'){
    console.log('******************************');
    console.log('******** BEGIN OUTPUT ********')
    console.log('******************************');
    console.log('Instance\tType\tSize(GB)\tUtilization\tMonthly\tReserved\tDisk');
    async.each(instances, function(i, tabCB){
      //ugly hack to catch any missing data
      if(!i.name) {i.name = 'Unknown'}
      if(!i.size) {i.size = 'Unknown'}
      if(!i.totalDisk) {i.totalDisk = 'Unknown'}
      if(!i.utilization)
      {i.utilization = 'Unknown'}
      else if(i.utilization != 'No data')
      {i.utilization = i.utilization.toFixed(2) + '%'}
      if(!i.monthly) {i.monthly = 'Unknown'}
      if(!i.reserved) {i.reserved = 'Unknown'}
      if(!i.diskCost)
      {i.diskCost = 'Unknown'}
      else if(i.diskCost != 'Unknown')
      {i.diskCost = i.diskCost.toFixed(2)}
      console.log(
        i.name+'\t'+
        i.size+'\t'+
        i.totalDisk+'\t'+
        i.utilization+'\t'+
        i.monthly+'\t'+
        i.reserved+'\t'+
        i.diskCost
      );
      tabCB();
    })
  } else if(output === 'csv'){

  } else if(output === 'json'){

  } else {
    var table = new Table({
      head: ['Instance', 'Type', 'Size(GB)', 'Utilization', '$Monthly', '$Reserved', '$Disk' ],
      colWidths: [20, 10, 10, 10, 10, 10, 10 ]
    });
    async.each(instances, function(i, printCB){
      //ugly hack to catch any missing data
      if(!i.name) {i.name = 'Unknown'}
      if(!i.size) {i.size = 'Unknown'}
      if(!i.totalDisk) {i.totalDisk = 'Unknown'}
      if(!i.utilization)
      {i.utilization = 'Unknown'}
      else if(i.utilization != 'No data')
      {i.utilization = i.utilization.toFixed(2) + '%'}
      if(!i.monthly) {i.monthly = 'Unknown'}
      if(!i.reserved) {i.reserved = 'Unknown'}
      if(!i.diskCost)
      {i.diskCost = 'Unknown'}
      else if(i.diskCost != 'Unknown')
      {i.diskCost = i.diskCost.toFixed(2)}
      table.push([
        i.name,
        i.size,
        i.totalDisk,
        i.utilization,
        i.monthly,
        i.reserved,
        i.diskCost
      ]);
      printCB();
    });
    console.log(table.toString());
  }

  console.log('async series completed');
});


var fake = { InstanceId: 'i-696a5743',
  ImageId: 'ami-1836cd70',
  State: { Code: 16, Name: 'running' },
  PrivateDnsName: 'ip-10-250-11-199.ec2.internal',
    PublicDnsName: 'ec2-54-84-252-217.compute-1.amazonaws.com',
  StateTransitionReason: '',
  KeyName: 'devops',
  AmiLaunchIndex: 0,
  ProductCodes:
  [ { ProductCodeId: '8fvdn95s5ev33cprr62nq3q7t',
    ProductCodeType: 'marketplace' } ],
    InstanceType: 'm3.large',
  LaunchTime: 'Mon May 18 2015 15:45:50 GMT-0700 (MST)',
  Placement:
  { AvailabilityZone: 'us-east-1a',
    GroupName: '',
    Tenancy: 'default' },
  KernelId: 'aki-88aa75e1',
    Monitoring: { State: 'disabled' },
  SubnetId: 'subnet-5ca09e1a',
    VpcId: 'vpc-92ef1dfe',
  PrivateIpAddress: '10.250.11.199',
  PublicIpAddress: '54.84.252.217',
  Architecture: 'x86_64',
  RootDeviceType: 'ebs',
  RootDeviceName: '/dev/sda1',
  BlockDeviceMappings: [ { DeviceName: '/dev/sda1', Ebs: [Object] } ],
  VirtualizationType: 'paravirtual',
  ClientToken: 'qkUHy1405989837114',
  Tags: [ { Key: 'Name', Value: 'smtp' } ],
  SecurityGroups: [ { GroupName: 'SMTP Relay', GroupId: 'sg-8a82fbef' } ],
  SourceDestCheck: true,
  Hypervisor: 'xen',
  NetworkInterfaces:
  [ { NetworkInterfaceId: 'eni-fce2c3a5',
    SubnetId: 'subnet-5ca09e1a',
    VpcId: 'vpc-92ef1dfe',
    Description: 'Primary network interface',
    OwnerId: '961839081442',
    Status: 'in-use',
    MacAddress: '0e:49:e7:ae:f6:c9',
    PrivateIpAddress: '10.250.11.199',
    PrivateDnsName: 'ip-10-250-11-199.ec2.internal',
    SourceDestCheck: true,
    Groups: [Object],
    Attachment: [Object],
    Association: [Object],
    PrivateIpAddresses: [Object] } ],
    EbsOptimized: false }
