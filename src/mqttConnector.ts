import mqtt from "mqtt"; 

const PRODUCTION_SUFFIX = "production"
const CHARGING_SETPOINT_SUFFIX = "chargingSetPoint"

type chargingSetPoint = {
    chargingSetPoint: number;
}

type Callback = {
    (chargingSetPoint: number): void;
  };

export class MQTTConnector {

    client: mqtt.MqttClient | undefined;
    callbacks = new Map<string, Callback>() 

    connect(url: string) {
        this.client = mqtt.connect(url);

        this.client.on("message", (topic, message) => {
            const callback = this.callbacks.get(topic)

            if (callback != undefined) {
                const msg: chargingSetPoint = JSON.parse(message.toString())
                callback(msg.chargingSetPoint)
            }
        })
    }

    publishPVProduction(nodeId: string, production: number) {
        this.client?.publish(`${nodeId}/${PRODUCTION_SUFFIX}`, JSON.stringify({production: production}))
    }

    subscribeChargingSetPoint(nodeId: string, callback: Callback) {
        const topic = `${nodeId}/${CHARGING_SETPOINT_SUFFIX}`
        this.callbacks.set(topic, callback)
        this.client?.subscribe(topic)
    }

    unsubscribeChargingSetPoint(nodeId: string) {
        const topic = `${nodeId}/${CHARGING_SETPOINT_SUFFIX}`
        this.client?.unsubscribe(topic)
        this.callbacks.delete(topic)
    }

    disconnect() {
        this.client?.end()
        this.client = undefined
    }
}