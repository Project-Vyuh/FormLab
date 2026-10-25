import { randomBytes, createHash, scrypt as derive, timingSafeEqual, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { problem } from './config.mjs';
const scrypt = promisify(derive);
// OWASP scrypt baseline: N=2^15, r=8, p=3 (~32 MiB). Version the stored encoding for future upgrades.
const passwordOptions = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const digest = token => createHash('sha256').update(token).digest('hex');
export const userView = user => ({ uid: user.id, email: user.email, displayName: user.name, photoURL: null, emailVerified: true, providerData: [{ providerId: 'local' }] });
export function authentication(store, config) {
  const cookie = (token, age) => `formlab_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}`;
  const tokenFrom = req => /(?:^|;\s*)formlab_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
  return {
    current(req) {
      const token=tokenFrom(req);
      return token ? store.get('SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE hash=? AND expires>?', digest(token),Date.now()) : null;
    },
    async register(input) {
      const email=String(input.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254 || typeof input.password!=='string' || input.password.length<12 || input.password.length>128) throw problem(400,'INVALID_ACCOUNT','Use a valid email and a password of 12–128 characters');
      const salt=randomBytes(16).toString('hex');
      const hash=await scrypt(input.password,salt,64,passwordOptions);
      const user={id:randomUUID(),email,name:String(input.displayName || 'Local Creator').slice(0,100)};
      store.transaction(() => {
        if (!config.registration && store.get('SELECT count(*) AS n FROM users').n) throw problem(403,'REGISTRATION_CLOSED','Local account already exists; sign in');
        if(store.get('SELECT id FROM users WHERE email=?',email))throw problem(409,'ACCOUNT_EXISTS','An account already exists');
        store.run('INSERT INTO users VALUES(?,?,?,?)',user.id,email,user.name,`scrypt-v1:${salt}:${Buffer.from(hash).toString('hex')}`);
      });
      return user;
    },
    async login(input) {
      const email=String(input.email || '').trim().toLowerCase();
      if(typeof input.password!=='string'||input.password.length>128)throw problem(401,'INVALID_LOGIN','Email or password is incorrect');
      const user=store.get('SELECT * FROM users WHERE email=?',email);
      const encoding=user?.password || `scrypt-v1:${'0'.repeat(32)}:${'0'.repeat(128)}`;
      const modern=encoding.startsWith('scrypt-v1:');
      const [salt,expected]=encoding.replace(/^scrypt-v1:/,'').split(':');
      const actual=Buffer.from(await scrypt(input.password,salt,64,modern?passwordOptions:{}));
      if(!timingSafeEqual(actual,Buffer.from(expected,'hex'))||!user)throw problem(401,'INVALID_LOGIN','Email or password is incorrect');
      if(!modern){const upgraded=Buffer.from(await scrypt(input.password,salt,64,passwordOptions));store.run('UPDATE users SET password=? WHERE id=?',`scrypt-v1:${salt}:${upgraded.toString('hex')}`,user.id);}
      return user;
    },
    session(user, req) {
      const previous=tokenFrom(req);if(previous)store.run('DELETE FROM sessions WHERE hash=?',digest(previous));
      store.run('DELETE FROM sessions WHERE expires<?',Date.now());
      const token=randomBytes(32).toString('hex');
      store.run('INSERT INTO sessions VALUES(?,?,?)',digest(token),user.id,Date.now()+86400000);
      return cookie(token,86400);
    },
    logout(req) { const token=tokenFrom(req);if(token)store.run('DELETE FROM sessions WHERE hash=?',digest(token));return cookie('',0); },
  };
}
