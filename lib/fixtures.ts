import type { Order, Source } from './types';
export const FIXTURE_NOW = '2026-10-01T12:00:00.000Z';
export const orders: Order[] = [];
function source(id:string,orderId:string|null,type:string,title:string,text:string,timestamp='2026-09-30T09:00:00.000Z',extra:Partial<Source>={}):Source {
 return {id,orderId,accountId:orders.find(o=>o.id===orderId)?.accountId??null,type,title,text,timestamp,version:null,effectiveFrom:null,effectiveTo:null,region:null,photo:null,...extra};
}
export const sources: Source[] = [
 source('POL-US-2',null,'policy','US delivery dispute policy','Synthetic policy DNR v2. Applies to US orders on or after 2026-09-01. An agent may approve a simulated refund initiation when: the current speaker is verified as the recipient or authorized representative; a delivery scan and non-receipt complaint exist; at least 24 hours have elapsed since the scan; order value is at most USD 200; and the refund ledger shows no initiation. A previous promise alone does not confer eligibility. Where any prerequisite or applicable policy is missing, escalate to Dispute Review. If initiation already exists, review its status; never initiate twice. Uploaded photos do not establish receipt. Conflicting delivery claims require investigation, not a finding of courier fault.','2026-09-01T00:00:00.000Z',{version:'2.0',effectiveFrom:'2026-09-01T00:00:00.000Z',effectiveTo:null,region:'US'}),
 source('POL-US-1',null,'policy','Retired US policy','Synthetic policy DNR v1. Previously required 48 hours before review. Retired; not applicable on or after 2026-09-01.','2026-01-01T00:00:00.000Z',{version:'1.0',effectiveFrom:'2026-01-01T00:00:00.000Z',effectiveTo:'2026-09-01T00:00:00.000Z',region:'US'})
];
