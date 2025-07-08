const express = require("express");
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const cors = require("cors");
const Web3 = require("web3").default;

const app = express();
app.use(cors({
  origin: "https://faucet-tora.netlify.app" // libera só seu frontend
}));
app.use(express.json());

// === CONFIGURAÇÕES via .env ===
require('dotenv').config();

const SECRET_KEY = process.env.SECRET_KEY;
const INFURA_URL = process.env.INFURA_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;

const web3 = new Web3(INFURA_URL);
const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
web3.eth.accounts.wallet.add(account);
web3.eth.defaultAccount = account.address;

// ABI do token (função transfer)
const tokenAbi = [
  {
    constant: false,
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    type: "function"
  }
];

const contract = new web3.eth.Contract(tokenAbi, TOKEN_ADDRESS);

// Guarda timestamps dos últimos claims por wallet (em memória)
const lastClaimTimestamps = {};

app.post("/verify-captcha", async (req, res) => {
  const captchaToken = req.body.response;
  const address = req.body.address?.toLowerCase();

  if (!captchaToken || !address) {
    return res.status(400).json({ success: false, message: "Token ou endereço ausente." });
  }

  // Verifica o reCAPTCHA com o Google
  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `secret=${SECRET_KEY}&response=${captchaToken}`
  });

  const data = await response.json();
  if (!data.success) {
    return res.status(400).json({ success: false, message: "CAPTCHA inválido." });
  }

  // Verifica o bloqueio de 24 horas
  const now = Date.now();
  const lastClaim = lastClaimTimestamps[address] || 0;
  const hoursSinceLastClaim = (now - lastClaim) / (1000 * 60 * 60);

  if (hoursSinceLastClaim < 24) {
    const hoursLeft = (24 - hoursSinceLastClaim).toFixed(1);
    return res.status(429).json({ success: false, message: `Você já fez claim nas últimas 24h. Tente novamente em ${hoursLeft}h.` });
  }

  try {
    const amount = web3.utils.toWei("10", "ether"); // 10 TORA
    const tx = await contract.methods.transfer(address, amount).send({
      from: account.address,
      gas: 100000
    });

    lastClaimTimestamps[address] = now; // atualiza timestamp do último claim

    console.log(`✅ TORA enviado para ${address}: ${tx.transactionHash}`);
    res.json({ success: true, txHash: tx.transactionHash });
  } catch (error) {
    console.error("Erro ao transferir TORA:", error);
    res.status(500).json({ success: false, message: "Erro ao enviar tokens" });
  }
});

// Porta que o Render ou ambiente define, ou 3000 localmente
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Backend rodando em http://localhost:${PORT}`);
});




