/**
 * Minimal SMTP client for Cloudflare Workers (cloudflare:sockets).
 */

const CRLF = '\r\n';

async function getConnect() {
  try {
    const mod = await import('cloudflare:sockets');
    return mod.connect;
  } catch {
    return null;
  }
}

function resolveSecureTransport(port, secure) {
  if (secure === 'ssl' || secure === 'on' || port === 465) return 'on';
  if (secure === 'starttls' || port === 587) return 'starttls';
  return 'off';
}

function encodeBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function buildMime({ fromEmail, fromName, to, subject, html, text }) {
  const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
  ];

  if (html && text) {
    const boundary = `----=_GoBunny_${Date.now()}`;
    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    lines.push('');
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/plain; charset=UTF-8');
    lines.push('Content-Transfer-Encoding: 8bit');
    lines.push('');
    lines.push(text);
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/html; charset=UTF-8');
    lines.push('Content-Transfer-Encoding: 8bit');
    lines.push('');
    lines.push(html);
    lines.push(`--${boundary}--`);
  } else if (html) {
    lines.push('Content-Type: text/html; charset=UTF-8');
    lines.push('Content-Transfer-Encoding: 8bit');
    lines.push('');
    lines.push(html);
  } else {
    lines.push('Content-Type: text/plain; charset=UTF-8');
    lines.push('Content-Transfer-Encoding: 8bit');
    lines.push('');
    lines.push(text || '');
  }

  return lines.join(CRLF);
}

class SmtpSession {
  constructor(readable, writable) {
    this.reader = readable.getReader();
    this.writer = writable.getWriter();
    this.decoder = new TextDecoder();
    this.buffer = '';
  }

  async readLine() {
    while (!this.buffer.includes('\n')) {
      const { value, done } = await this.reader.read();
      if (done) break;
      this.buffer += this.decoder.decode(value || new Uint8Array(), { stream: true });
    }
    const idx = this.buffer.indexOf('\n');
    if (idx === -1) throw new Error('SMTP connection closed unexpectedly');
    const line = this.buffer.slice(0, idx).replace(/\r$/, '');
    this.buffer = this.buffer.slice(idx + 1);
    return line;
  }

  async readResponse(expectedPrefix) {
    const line = await this.readLine();
    const code = parseInt(line.slice(0, 3), 10);
    if (expectedPrefix && code !== expectedPrefix) {
      throw new Error(`SMTP expected ${expectedPrefix}, got: ${line}`);
    }
    return { code, line };
  }

  async readMultiline(expectedPrefix) {
    let last;
    do {
      last = await this.readResponse(expectedPrefix);
    } while (last.line.length > 3 && last.line[3] === '-');
    return last;
  }

  async send(command) {
    await this.writer.write(new TextEncoder().encode(command + CRLF));
  }

  async command(command, expectedCode) {
    await this.send(command);
    if (expectedCode) {
      return this.readMultiline(expectedCode);
    }
    return null;
  }

  async close() {
    try {
      await this.command('QUIT', 221);
    } catch {
      /* ignore */
    }
    try {
      await this.writer.close();
    } catch {
      /* ignore */
    }
    try {
      await this.reader.cancel();
    } catch {
      /* ignore */
    }
  }
}

/**
 * @param {object} smtp - host, port, secure, username, password, from_email, from_name
 * @param {object} message - to, subject, html, text
 */
export async function sendSmtpMail(smtp, message) {
  const connect = await getConnect();
  if (!connect) {
    throw new Error('SMTP is only available in the Cloudflare Workers runtime');
  }

  const host = smtp.host?.trim();
  const port = parseInt(String(smtp.port || 587), 10);
  if (!host) throw new Error('SMTP host is required');

  const socket = connect({
    hostname: host,
    port,
    secureTransport: resolveSecureTransport(port, smtp.secure),
  });

  const session = new SmtpSession(socket.readable, socket.writable);
  await session.readResponse(220);
  await session.command(`EHLO ${host}`, 250);

  if (smtp.username) {
    await session.command('AUTH LOGIN', 334);
    await session.command(encodeBase64(smtp.username), 334);
    await session.command(encodeBase64(smtp.password || ''), 235);
  }

  const fromEmail = smtp.from_email?.trim();
  if (!fromEmail) throw new Error('From email is required');

  await session.command(`MAIL FROM:<${fromEmail}>`, 250);
  await session.command(`RCPT TO:<${message.to}>`, 250);
  await session.command('DATA', 354);

  const mime = buildMime({
    fromEmail,
    fromName: smtp.from_name,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });

  await session.send(mime);
  await session.send('.');
  await session.readResponse(250);
  await session.close();

  return { ok: true };
}
