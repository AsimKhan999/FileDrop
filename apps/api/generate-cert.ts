import forge from "node-forge";
import fs from "fs";
import path from "path";

const keys = forge.pki.rsa.generateKeyPair(2048);
const cert = forge.pki.createCertificate();

cert.publicKey = keys.publicKey;
cert.serialNumber = "01";
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

const attrs = [{ name: "commonName", value: "FileDrop LAN" }];
cert.setSubject(attrs);
cert.setIssuer(attrs);

cert.setExtensions([
  { name: "subjectAltName", altNames: [
    { type: 2, value: "localhost" },
    { type: 7, ip: "127.0.0.1" },
    { type: 7, ip: "192.168.100.126" },
  ]},
]);

cert.sign(keys.privateKey, forge.md.sha256.create());

const certPem = forge.pki.certificateToPem(cert);
const keyPem = forge.pki.privateKeyToPem(keys.privateKey);

const certDir = path.join(__dirname, "src", "certs");
if (!fs.existsSync(certDir)) fs.mkdirSync(certDir);

fs.writeFileSync(path.join(certDir, "cert.pem"), certPem);
fs.writeFileSync(path.join(certDir, "key.pem"), keyPem);

console.log("> Self-signed certificate generated in apps/api/src/certs/");
