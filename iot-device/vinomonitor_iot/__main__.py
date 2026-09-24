"""Pokretanje: python -m vinomonitor_iot [--config settings.json] [--simulate] [--dry-run]"""

from __future__ import annotations

import argparse
import json
import logging
import signal
import sys

from .config import ConfigError, load_settings


def main() -> int:
    parser = argparse.ArgumentParser(prog="vinomonitor_iot", description="vinoMonitor Raspberry Pi sensor client")
    parser.add_argument("--config", default="settings.json", help="path to settings.json")
    parser.add_argument("--simulate", action="store_true", help="use simulated sensors (no hardware needed)")
    parser.add_argument("--dry-run", action="store_true", help="read sensors once, print JSON, don't use MQTT")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
    )

    try:
        settings = load_settings(args.config)
    except ConfigError as e:
        logging.error("%s", e)
        return 2
    if args.simulate:
        settings.simulate = True

    # Import posle parsiranja da bi --help radio i bez paho-mqtt
    from .device import Device

    device = Device(settings)

    if args.dry_run:
        for _, payload in device.read_all():
            print(json.dumps(payload, ensure_ascii=False))
        for reader in device.readers:
            reader.close()
        return 0

    def handle_signal(signum, frame):
        device.stop()

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    device.run()
    return 0


if __name__ == "__main__":
    sys.exit(main())
