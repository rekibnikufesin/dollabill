## DollaBill

Analyzes servers in AWS, and calculates total cost of ownership for the instance + storage and displays along side the average utilization for the last 2 weeks.  Outputs to json, tab-delimited, csv, or console table (default).

## Example

$ node dollabill
 (table output)



```
┌────────────────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│ Instance           │ Type     │ Size(GB) │ Utiliza… │ $Monthly │ $Reserv… │ $Disk    │
├────────────────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ proftpd            │ m1.small │ 8        │ 9.96     │ 31.68    │ 7.3      │ 0.80     │
├────────────────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ devops-staging2    │ m3.medi… │ 20       │ 9.33     │ 48.24    │ 12.41    │ 2.00     │
```

json output

```
coming soon
```

tab delimited

```
Instance	Type	Size(GB)	Utilization	Monthly	Reserved	Disk
apache-web1	m3.large	8	24.79%	95.76	25.55	0.8
apache-web2	m3.large	8	24.88%	95.76	25.55	0.8
```


## Motivation

It's easy to let expenses get out of control in AWS, and difficult to see where the money is going. This is a step towards corraling that problem.

## Installation

npm install -g https://github.com/rekibnikufesin/dollabill

## ToDo

Add support for different output formats (currently only table and tab exist)
Add tests
Add support for vSphere infrastructure
Add support for pulling utilization metrics from zabbix

