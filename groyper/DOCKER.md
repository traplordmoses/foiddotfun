# Docker Setup for Groyper Server

## Quick Start

1. **Create a `.env` file** in the groyper directory with:
```env
RPC_URL=https://eth.llamarpc.com
CONTRACT_ADDRESS=0xYourContractAddress
SERVER_ADDRESS=0xYourServerAddress
PORT=3000
DB_PATH=./data/messages.db
```

2. **Build and run with Docker Compose:**
```bash
docker-compose up -d
```

3. **View logs:**
```bash
docker-compose logs -f
```

4. **Stop the server:**
```bash
docker-compose down
```

## Building the Image

```bash
docker build -t groyper-server .
```

## Running the Container

```bash
docker run -d \
  --name groyper-server \
  -p 3000:3000 \
  -e RPC_URL=https://eth.llamarpc.com \
  -e CONTRACT_ADDRESS=0xYourContractAddress \
  -e SERVER_ADDRESS=0xYourServerAddress \
  -v $(pwd)/data:/app/data \
  groyper-server
```

## Database Persistence

The database file is stored in `./data/messages.db` and is persisted via Docker volumes.

## For TEE (Trusted Execution Environment)

To run in a TEE, you'll need:
1. TEE-compatible Docker runtime (e.g., Intel SGX, AMD SEV, or AWS Nitro Enclaves)
2. Additional TEE configuration in your deployment environment
3. Modified docker-compose.yml with TEE-specific settings

Example for AWS Nitro Enclaves:
- Use `nitro-cli` to build an enclave image
- Configure the EIF (Enclave Image Format) instead of standard Docker

## Environment Variables

All environment variables from `.env` can be passed to the container via:
- `docker-compose.yml` (recommended)
- `-e` flags in `docker run`
- Environment file mounting (less secure)

## Troubleshooting

- **Database issues**: Ensure `./data` directory exists and is writable
- **Port conflicts**: Change port mapping in docker-compose.yml
- **Build failures**: Check Node.js version compatibility

