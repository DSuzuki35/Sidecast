import test from 'node:test';
import assert from 'node:assert/strict';
import {privateIPv4,lanAddresses} from '../src/network.js';
import {normalizeSettings} from '../src/core/settings.js';
test('LAN is opt-in and addresses are private IPv4 only',()=>{
 assert.equal(normalizeSettings().lanEnabled,false);
 assert.equal(normalizeSettings({lanEnabled:'true'}).lanEnabled,false);
 assert.equal(normalizeSettings({lanEnabled:true}).lanEnabled,true);
 for(const ip of ['10.1.2.3','172.16.0.1','172.31.255.2','192.168.1.20'])assert.equal(privateIPv4(ip),true);
 for(const ip of ['127.0.0.1','8.8.8.8','172.32.0.1','169.254.1.2','192.168.1.999','::1','evil.example'])assert.equal(privateIPv4(ip),false);
 assert.deepEqual(lanAddresses({WiFi:[{family:'IPv4',internal:false,address:'192.168.1.20'},{family:'IPv6',internal:false,address:'::1'}],Loopback:[{family:'IPv4',internal:true,address:'127.0.0.1'}],Public:[{family:'IPv4',internal:false,address:'8.8.8.8'}]}),[{name:'WiFi',address:'192.168.1.20'}]);
});
