#!/usr/bin/env bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

MODEL="qwen3:8b"
OLLAMA_URL="http://localhost:11434"

print_status() { echo -e "${CYAN}[*]${NC} $1"; }
print_ok()    { echo -e "${GREEN}[✓]${NC} $1"; }
print_warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
print_err()   { echo -e "${RED}[✗]${NC} $1"; }

# --- Detect distro ---
detect_distro() {
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    case "$ID" in
      arch|manjaro|endeavouros|cachyos|garuda|arco)
        DISTRO="arch"
        PKGMGR="pacman"
        ;;
      debian|ubuntu|linuxmint|pop)
        DISTRO="debian"
        PKGMGR="apt"
        ;;
      fedora)
        DISTRO="fedora"
        PKGMGR="dnf"
        ;;
      *)
        DISTRO="unknown"
        PKGMGR="unknown"
        ;;
    esac
    DISTRO_NAME="${PRETTY_NAME:-$ID}"
  else
    DISTRO="unknown"
    PKGMGR="unknown"
    DISTRO_NAME="unknown"
  fi
}

# --- Check functions ---
check_cmd() {
  command -v "$1" &>/dev/null
}

check_node() {
  if check_cmd node; then
    print_ok "Node.js $(node -v)"
  else
    print_err "Node.js not found"
    echo "  Install: https://nodejs.org/ or use nvm"
    exit 1
  fi
}

check_npm() {
  if check_cmd npm; then
    print_ok "npm $(npm -v)"
  else
    print_err "npm not found"
    exit 1
  fi
}

check_rust() {
  if check_cmd cargo; then
    local ver
    ver=$(cargo --version 2>/dev/null | awk '{print $2}') || true
    print_ok "Cargo $ver"
  else
    print_err "Rust/Cargo not found"
    echo "  Install: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
  fi
}

check_tauri_cli() {
  if cargo tauri --version &>/dev/null; then
    TAURI_CMD="cargo tauri"
    print_ok "cargo-tauri installed"
  elif npx tauri --version &>/dev/null 2>&1; then
    TAURI_CMD="npx tauri"
    print_ok "npx tauri available"
  else
    print_warn "cargo-tauri not found, installing via cargo..."
    cargo install tauri-cli
    TAURI_CMD="cargo tauri"
    print_ok "cargo-tauri installed"
  fi
}

check_ollama() {
  if check_cmd ollama; then
    print_ok "Ollama $(ollama --version 2>&1 | awk '{print $3}')"
  else
    print_err "Ollama not found"
    echo "  Install: https://ollama.com/download"
    exit 1
  fi
}

pkg_installed() {
  case "$PKGMGR" in
    pacman) pacman -Qi "$1" &>/dev/null ;;
    apt)    dpkg -s "$1" &>/dev/null ;;
    dnf)    rpm -q "$1" &>/dev/null ;;
    *)      false ;;
  esac
}

install_pkgs() {
  case "$PKGMGR" in
    pacman) sudo pacman -S --noconfirm "$@" ;;
    apt)    sudo apt install -y "$@" ;;
    dnf)    sudo dnf install -y "$@" ;;
  esac
}

check_system_deps() {
  local missing=()
  local display_names=()
  local pkgs=()

  case "$PKGMGR" in
    pacman)
      pkgs=(webkit2gtk-4.1 base-devel openssl gtk3 libappindicator-gtk3 librsvg curl wget)
      display_names=("${pkgs[@]}")
      ;;
    apt)
      pkgs=(libwebkit2gtk-4.1-dev build-essential libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev curl wget)
      display_names=("${pkgs[@]}")
      ;;
    dnf)
      pkgs=(webkit2gtk4.1-devel openssl-devel gtk3-devel libappindicator-gtk3-devel librsvg2-devel curl wget)
      display_names=("${pkgs[@]}")
      ;;
    *)
      print_warn "Cannot detect package manager, skipping system deps check"
      return
      ;;
  esac

  for i in "${!pkgs[@]}"; do
    local pkg="${pkgs[$i]}"
    local name="${display_names[$i]}"
    if pkg_installed "$pkg"; then
      print_ok "$name"
    else
      print_warn "$name — not installed"
      missing+=("$pkg")
    fi
  done

  if [ ${#missing[@]} -gt 0 ]; then
    echo ""
    print_warn "Missing system packages."
    read -p "Install now? (y/N) " -r
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      install_pkgs "${missing[@]}"
    else
      print_err "Cannot continue without system dependencies"
      exit 1
    fi
  fi
}

# --- Main ---
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  NewEra — Local AI Workspace Launcher${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

detect_distro
print_ok "Detected: $DISTRO_NAME ($PKGMGR)"
echo ""

print_status "Checking system dependencies..."
check_system_deps
echo ""

print_status "Checking Node.js..."
check_node
check_npm
echo ""

print_status "Checking Rust..."
check_rust
echo ""

print_status "Checking Ollama..."
check_ollama
echo ""

print_status "Checking Tauri CLI..."
check_tauri_cli
echo ""

# --- npm install ---
print_status "Installing npm dependencies..."
if [ -d "node_modules" ] && [ -f "package-lock.json" ]; then
  npm_install_hash=$(md5sum package-lock.json | awk '{print $1}')
  if [ -f ".npm_hash" ] && [ "$(cat .npm_hash)" = "$npm_install_hash" ]; then
    print_ok "node_modules up to date"
  else
    npm install
    echo "$npm_install_hash" > .npm_hash
  fi
else
  npm install
  md5sum package-lock.json | awk '{print $1}' > .npm_hash
fi
echo ""

# --- Start Ollama ---
print_status "Starting Ollama..."
if pgrep -x "ollama" > /dev/null; then
  print_ok "Ollama already running"
else
  ollama serve > /dev/null 2>&1 &
  sleep 2
  if curl -s "$OLLAMA_URL/api/tags" > /dev/null 2>&1; then
    print_ok "Ollama started"
  else
    print_warn "Ollama may still be starting..."
  fi
fi
echo ""

# --- Model selection ---
print_status "Detecting installed models..."

# Get list of installed models (name + size)
mapfile -t INSTALLED_MODELS < <(ollama list 2>/dev/null | awk 'NR>1 {print $1}')

# Known chat models with sizes + purpose
declare -A RECOMMENDED=(
  ["qwen2.5:3b"]="1.8 GB — general, fast"
  ["qwen2.5:7b"]="4.4 GB — general, balanced"
  ["qwen2.5:14b"]="8.9 GB — general, high quality"
  ["qwen2.5:32b"]="19 GB — general, very high quality"
  ["qwen3:4b"]="2.5 GB — newer gen, smart general"
  ["qwen3:8b"]="5.0 GB — newer gen, all-rounder"
  ["qwen3:14b"]="8.9 GB — newer gen, high quality"
  ["phi3:3.8b"]="2.2 GB — Microsoft, learning & math"
  ["phi3:14b"]="7.9 GB — Microsoft, learning, larger"
  ["phi4-mini:3.8b"]="2.2 GB — Microsoft, math & science homework"
  ["gemma2:2b"]="1.6 GB — Google, tiny & quick"
  ["gemma3:4b"]="3.3 GB — Google, modern & balanced"
  ["gemma3:12b"]="8.1 GB — Google, high quality"
  ["gemma3:27b"]="16 GB — Google, large"
  ["llama3.1:8b"]="4.7 GB — Meta, popular all-rounder"
  ["llama3.2:3b"]="2.0 GB — Meta, light"
  ["llama3.3:70b"]="40 GB — Meta, massive"
  ["mistral:7b"]="4.1 GB — Mistral, fast chat"
  ["qwen2.5-coder:7b"]="4.7 GB — coding & code review"
  ["qwen2.5-coder:14b"]="8.9 GB — coding, high quality"
  ["codellama:7b"]="3.8 GB — coding, classic"
  ["deepseek-r1:7b"]="4.7 GB — DeepSeek, reasoning"
  ["glm4:9b"]="5.5 GB — Zhipu, bilingual (EN/中文)"
)

# Ordered list of models offered for download in menus
CANDIDATES=(
  "qwen2.5:3b"
  "qwen3:4b"
  "qwen3:8b"
  "phi3:3.8b"
  "phi4-mini:3.8b"
  "gemma2:2b"
  "gemma3:4b"
  "gemma3:12b"
  "llama3.1:8b"
  "llama3.2:3b"
  "mistral:7b"
  "qwen2.5-coder:7b"
  "qwen2.5-coder:14b"
  "codellama:7b"
  "deepseek-r1:7b"
  "glm4:9b"
  "phi3:14b"
  "qwen2.5:7b"
  "qwen2.5:14b"
  "qwen3:14b"
)

# Show menu of all candidate models, sets MODEL
pick_from_candidates() {
  local n=1
  for m in "${CANDIDATES[@]}"; do
    echo "    $n) $m — ${RECOMMENDED[$m]}"
    n=$((n+1))
  done
  echo ""
  read -p "  Choose model [1-${#CANDIDATES[@]}] (default: 1): " -r PC
  if [ -n "$PC" ] && [ "$PC" -ge 1 ] 2>/dev/null && [ "$PC" -le "${#CANDIDATES[@]}" ]; then
    MODEL="${CANDIDATES[$((PC-1))]}"
  else
    MODEL="${CANDIDATES[0]}"
  fi
  print_status "Pulling $MODEL..."
  ollama pull "$MODEL"
}

# Filter to only show models that make sense for chat (skip tiny embedding models)
CHAT_MODELS=()
for m in "${INSTALLED_MODELS[@]}"; do
  # Skip embedding models and models smaller than 500MB
  if [[ "$m" == *":embed"* ]] || [[ "$m" == *"embedding"* ]]; then
    continue
  fi
  CHAT_MODELS+=("$m")
done

echo ""
if [ ${#CHAT_MODELS[@]} -eq 0 ]; then
  print_warn "No chat models found on this device."
  echo ""
  echo -e "  ${CYAN}Suggestions by purpose:${NC}"
  echo "    1) qwen3:8b         — general, smart all-rounder (default)"
  echo "    2) phi4-mini:3.8b   — learning, math, physics homework"
  echo "    3) qwen2.5-coder:7b — coding, programming, code review"
  echo "    4) gemma3:4b        — Google, balanced general"
  echo "    5) qwen2.5:3b       — general, fast, lightweight"
  echo "    6) Browse all models..."
  echo ""
  read -p "  Choose model [1-6] (default: 1): " -r CHOICE
  case "$CHOICE" in
    2) MODEL="phi4-mini:3.8b"
       print_status "Pulling $MODEL..."
       ollama pull "$MODEL" ;;
    3) MODEL="qwen2.5-coder:7b"
       print_status "Pulling $MODEL..."
       ollama pull "$MODEL" ;;
    4) MODEL="gemma3:4b"
       print_status "Pulling $MODEL..."
       ollama pull "$MODEL" ;;
    5) MODEL="qwen2.5:3b"
       print_status "Pulling $MODEL..."
       ollama pull "$MODEL" ;;
    6) pick_from_candidates ;;
    *) MODEL="qwen3:8b"
       print_status "Pulling $MODEL..."
       ollama pull "$MODEL" ;;
  esac
else
  echo -e "  ${CYAN}Installed models:${NC}"
  echo ""
  for i in "${!CHAT_MODELS[@]}"; do
    local_model="${CHAT_MODELS[$i]}"
    local_desc="${RECOMMENDED[$local_model]:-custom model}"
    echo "    $((i+1))) $local_model  — $local_desc"
  done
  echo ""
  echo "    $(( ${#CHAT_MODELS[@]} + 1 ))) Pull a different model..."
  echo ""
  read -p "  Choose model [1-$(( ${#CHAT_MODELS[@]} + 1 ))] (default: 1): " -r CHOICE

  if [ "$CHOICE" = "$(( ${#CHAT_MODELS[@]} + 1 ))" ] 2>/dev/null; then
    echo ""
    echo -e "  ${CYAN}Available models:${NC}"
    echo ""
    pick_from_candidates
  elif [ -n "$CHOICE" ] && [ "$CHOICE" -ge 1 ] && [ "$CHOICE" -le "${#CHAT_MODELS[@]}" ] 2>/dev/null; then
    MODEL="${CHAT_MODELS[$((CHOICE-1))]}"
    print_ok "Selected: $MODEL"
  else
    MODEL="${CHAT_MODELS[0]}"
    print_ok "Selected: $MODEL (default)"
  fi
fi

print_ok "Using model: $MODEL"

# Save selected model for the app to read
echo "$MODEL" > .model
export NEWERA_MODEL="$MODEL"
echo ""

# --- Health check ---
print_status "Verifying Ollama connection..."
if curl -s "$OLLAMA_URL/api/tags" > /dev/null 2>&1; then
  print_ok "Ollama API reachable"
else
  print_err "Cannot reach Ollama at $OLLAMA_URL"
  exit 1
fi
echo ""

# --- Launch app ---
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  All checks passed! Starting NewEra...${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
print_warn "Press Ctrl+C to stop"
echo ""

if cargo tauri --version &>/dev/null; then
  cargo tauri dev
elif npx tauri --version &>/dev/null 2>&1; then
  npx tauri dev
else
  print_err "No Tauri CLI found"
  exit 1
fi
