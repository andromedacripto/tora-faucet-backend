<h1 align="center">🐯 TORA Faucet Backend</h1>

<p align="center">
  Backend oficial do <strong>TORA Faucet</strong> — um serviço que distribui tokens TORA em testnets Ethereum, permitindo que desenvolvedores testem interações com o token de forma gratuita.
</p>

---

## 📦 Instalação

Clone o repositório:

```bash
git clone https://github.com/andromedacripto/tora-faucet-backend.git
cd tora-faucet-backend

## ▶️ Uso da API

Com o backend rodando em `http://localhost:3000`, você pode fazer uma requisição `POST` para o endpoint `/claim`.

### 🔗 Endpoint

#### POST /claim

- Descrição: solicita tokens TORA para um endereço válido em uma testnet Ethereum.

- Corpo da requisição (JSON):
```json
{
  "address": "0xSeuEnderecoEthereum",
  "recaptchaToken": "token_do_recaptcha"
}


