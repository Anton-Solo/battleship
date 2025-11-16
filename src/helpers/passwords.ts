import { pbkdf2, randomBytes } from 'crypto';

export const hashPassword = (password: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    randomBytes(16, (err, salt) => {
      if (err) {
        reject(err);
      }

      pbkdf2(password, salt.toString('hex'), 1000, 64, 'sha512', (err, derivedKey) => {
        if (err) {
          reject(err);
        }

        resolve(`${salt.toString('hex')}:${derivedKey.toString('hex')}`);
      });
    });
  });
};

export const checkPassword = (password: string, hash: string): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const [salt, key] = hash.split(':');
    pbkdf2(password, salt, 1000, 64, 'sha512', (err, derivedKey) => {
      if (err) {
        reject(err);
      }

      resolve(key === derivedKey.toString('hex'));
    });
  });
};
