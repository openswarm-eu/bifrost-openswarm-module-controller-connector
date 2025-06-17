import mqtt from "mqtt"; 

const DEMAND_SUFFIX = "demand"
const SETPOINT_SUFFIX = "setPoint"
const MEASUREMENT_SUFFIX = "measurement"

type setPoint = {
    setPoint: number;
}

type Callback = {
    (setPoint: number): void;
  };

export class MQTTConnector {

    client: mqtt.MqttClient | undefined;
    callbacks = new Map<string, Callback>() 

    connect(url: string) {
        console.log(`connecting to MQTT broker ${url}`)
        this.client = mqtt.connect(url);

        this.client.on("connect", () => {
            console.log("connected to MQTT broker")
        });

        this.client.on("message", (topic, message) => {
            const callback = this.callbacks.get(topic)

            if (callback != undefined) {
                const msg: setPoint = JSON.parse(message.toString())
                callback(msg.setPoint)
            }
        })
    }

    publishDemand(nodeId: string, demand: number) {
        this.client?.publish(`${nodeId}/${DEMAND_SUFFIX}`, JSON.stringify({demand: demand}))
    }

    publishPowerMeasurement(nodeId: string, measurement: number) {
        this.client?.publish(`${nodeId}/${MEASUREMENT_SUFFIX}`, JSON.stringify({measurement: measurement}))
    }

    subscribeSetPoint(nodeId: string, callback: Callback) {
        const topic = `${nodeId}/${SETPOINT_SUFFIX}`
        this.callbacks.set(topic, callback)
        this.client?.subscribe(topic)
    }

    unsubscribeSetPoint(nodeId: string) {
        const topic = `${nodeId}/${SETPOINT_SUFFIX}`
        this.client?.unsubscribe(topic)
        this.callbacks.delete(topic)
    }

    disconnect() {
        this.client?.end()
        this.client = undefined
    }
}