#!/usr/bin/env bash
# Sustituto determinista de `claude -p` para pruebas: su comportamiento lo fija FAKE_MODE (vía fichero, porque
# el supervisor limpia el entorno): ok | lento | cuota | error | sinjson
MODE=$(cat "${TMPDIR:-/tmp}/fake-claude-mode" 2>/dev/null || echo ok)
case "$MODE" in
  ok)      echo '{"type":"result","is_error":false,"result":"hecho","session_id":"s-1","total_cost_usd":0.01,"num_turns":3}' ;;
  lento)   sleep 300; echo '{"is_error":false,"result":"tarde"}' ;;
  cuota)   echo '{"type":"result","is_error":true,"result":"Claude AI usage limit reached|1791800000","session_id":"s-2","total_cost_usd":0,"num_turns":1}'; exit 1 ;;
  error)   echo '{"type":"result","is_error":true,"result":"algo falló","session_id":"s-3","total_cost_usd":0.02,"num_turns":2}'; exit 1 ;;
  sinjson) echo "Error: no auth" >&2; exit 1 ;;
esac
