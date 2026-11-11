import { retryEmails } from "../src/lib/payments";
console.log(await retryEmails());
process.exit(0);
