import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import net from "node:net";
import tls from "node:tls";

function compactText(value) {
  return String(value || "").trim();
}

function boolEnv(value, fallback = false) {
  const text = compactText(value).toLowerCase();
  if (!text) {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(text);
}

function escapeHeader(value) {
  return compactText(value).replace(/[\r\n]+/g, " ");
}

function dotStuff(message) {
  return String(message || "")
    .replace(/\r?\n/g, "\r\n")
    .split("\r\n")
    .map((line) => (line.startsWith(".") ? `.${line}` : line))
    .join("\r\n");
}

function createVerificationMessage({ from, to, subject, text }) {
  const safeFrom = escapeHeader(from);
  const safeTo = escapeHeader(to);
  const safeSubject = escapeHeader(subject);
  return [
    `From: ${safeFrom}`,
    `To: ${safeTo}`,
    `Subject: ${safeSubject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    text,
  ].join("\r\n");
}

function connectSocket({ host, port, secure }) {
  return new Promise((resolve, reject) => {
    const socket = secure ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });
    socket.setTimeout(15000);
    socket.once(secure ? "secureConnect" : "connect", () => resolve(socket));
    socket.once("error", reject);
    socket.once("timeout", () => {
      socket.destroy(new Error("SMTP timeout"));
    });
  });
}

function createSmtpSession(socket) {
  let activeSocket = socket;
  let buffer = "";
  const waiters = [];

  const onData = (chunk) => {
    buffer += chunk.toString("utf8");
    flush();
  };

  const flush = () => {
    if (waiters.length === 0) {
      return;
    }
    const lines = buffer.split(/\r?\n/);
    if (!buffer.endsWith("\n")) {
      lines.pop();
    }
    const completeIndex = lines.findIndex((line) => /^\d{3} /.test(line));
    if (completeIndex < 0) {
      return;
    }
    const responseLines = lines.slice(0, completeIndex + 1);
    buffer = lines.slice(completeIndex + 1).join("\r\n");
    const waiter = waiters.shift();
    waiter.resolve(responseLines.join("\n"));
    flush();
  };

  const attach = (nextSocket) => {
    activeSocket = nextSocket;
    activeSocket.on("data", onData);
  };
  attach(activeSocket);

  const read = () =>
    new Promise((resolve, reject) => {
      waiters.push({ resolve, reject });
      flush();
    });

  const write = (line) =>
    new Promise((resolve, reject) => {
      activeSocket.write(`${line}\r\n`, "utf8", (error) => (error ? reject(error) : resolve()));
    });

  const expect = async (line, acceptedCodes) => {
    if (line) {
      await write(line);
    }
    const response = await read();
    const code = Number(response.slice(0, 3));
    if (!acceptedCodes.includes(code)) {
      throw new Error(`SMTP ${line || "connect"} failed: ${response}`);
    }
    return response;
  };

  const upgradeTls = (host) =>
    new Promise((resolve, reject) => {
      activeSocket.removeListener("data", onData);
      const secureSocket = tls.connect({ socket: activeSocket, servername: host }, () => {
        attach(secureSocket);
        resolve();
      });
      secureSocket.once("error", reject);
    });

  const end = () => activeSocket.end();
  return { expect, upgradeTls, end };
}

async function sendSmtpEmail(config, mail) {
  const host = compactText(config.smtpHost);
  const port = Number(config.smtpPort || (config.smtpSecure ? 465 : 587));
  const secure = boolEnv(config.smtpSecure, port === 465);
  const socket = await connectSocket({ host, port, secure });
  const session = createSmtpSession(socket);
  await session.expect("", [220]);
  await session.expect(`EHLO ${compactText(config.smtpHelo) || "scoutx.local"}`, [250]);
  if (!secure && boolEnv(config.smtpStartTls, true)) {
    await session.expect("STARTTLS", [220]);
    await session.upgradeTls(host);
    await session.expect(`EHLO ${compactText(config.smtpHelo) || "scoutx.local"}`, [250]);
  }
  const user = compactText(config.smtpUser);
  const pass = String(config.smtpPass || "");
  if (user || pass) {
    const auth = Buffer.from(`\0${user}\0${pass}`, "utf8").toString("base64");
    await session.expect(`AUTH PLAIN ${auth}`, [235]);
  }
  await session.expect(`MAIL FROM:<${mail.fromAddress}>`, [250]);
  await session.expect(`RCPT TO:<${mail.to}>`, [250, 251]);
  await session.expect("DATA", [354]);
  await session.expect(`${dotStuff(mail.message)}\r\n.`, [250]);
  await session.expect("QUIT", [221]);
  session.end();
}

async function appendOutbox(filePath, payload) {
  await mkdir(dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(payload)}\n`, "utf8");
}

export function createEmailDelivery(env = process.env) {
  const config = {
    smtpHost: compactText(env.ADAPTER_SMTP_HOST),
    smtpPort: Number(env.ADAPTER_SMTP_PORT || 0),
    smtpSecure: env.ADAPTER_SMTP_SECURE,
    smtpStartTls: env.ADAPTER_SMTP_STARTTLS,
    smtpUser: compactText(env.ADAPTER_SMTP_USER),
    smtpPass: String(env.ADAPTER_SMTP_PASS || ""),
    smtpHelo: compactText(env.ADAPTER_SMTP_HELO),
    from: compactText(env.ADAPTER_EMAIL_FROM) || "ScoutX <no-reply@scoutx.local>",
    fromAddress: compactText(env.ADAPTER_EMAIL_FROM_ADDRESS) || "no-reply@scoutx.local",
    outboxFile: compactText(env.ADAPTER_EMAIL_OUTBOX_FILE),
    webhookUrl: compactText(env.ADAPTER_EMAIL_WEBHOOK_URL),
  };
  const configured = Boolean(config.smtpHost || config.outboxFile || config.webhookUrl);

  async function sendVerificationEmail({ to, token, logger }) {
    if (!configured) {
      return { ok: false, skipped: true, reason: "mail_not_configured" };
    }
    const subject = "ScoutX E-Mail bestätigen";
    const text = [
      "Hallo,",
      "",
      "dein Bestätigungscode für ScoutX lautet:",
      "",
      token,
      "",
      "Der Code ist 24 Stunden gültig.",
      "Wenn du diese Registrierung nicht gestartet hast, ignoriere diese E-Mail.",
      "",
      "ScoutX",
    ].join("\n");
    const payload = {
      to,
      subject,
      text,
      createdAt: new Date().toISOString(),
      type: "team_email_verification",
    };
    if (config.outboxFile) {
      await appendOutbox(config.outboxFile, payload);
      return { ok: true, channel: "outbox" };
    }
    if (config.webhookUrl) {
      const response = await fetch(config.webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`Mail-Webhook HTTP ${response.status}`);
      }
      return { ok: true, channel: "webhook" };
    }
    const message = createVerificationMessage({ from: config.from, to, subject, text });
    await sendSmtpEmail(config, { to, fromAddress: config.fromAddress, message });
    logger?.info?.("verification email sent", { to, channel: "smtp" });
    return { ok: true, channel: "smtp" };
  }

  return {
    configured,
    sendVerificationEmail,
  };
}
