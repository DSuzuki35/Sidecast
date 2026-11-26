import {networkInterfaces} from 'node:os';
import {isIPv4} from 'node:net';
export function privateIPv4(address){
 if(!isIPv4(address))return false;
 const [a,b]=address.split('.').map(Number);
 return a===10||(a===172&&b>=16&&b<=31)||(a===192&&b===168);
}
export function lanAddresses(interfaces=networkInterfaces()){
 const seen=new Set(),result=[];
 for(const [name,entries] of Object.entries(interfaces))for(const entry of entries||[]){
  if(entry.internal||entry.family!=='IPv4'||!privateIPv4(entry.address)||seen.has(entry.address))continue;
  seen.add(entry.address);result.push({name,address:entry.address});
 }
 return result;
}
