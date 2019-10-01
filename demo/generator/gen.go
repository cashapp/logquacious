package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"time"
)

func main() {
	url := "http://es:9200/test/_doc/"
	nextCheck, duration := newDurations()

	for {
		time.Sleep(duration)

		payload, err := genPayload()
		if err != nil {
			log.Printf("could not send request: %+v", err)
			continue
		}

		resp, err := http.Post(url, "application/json", payload)
		if err != nil {
			log.Printf("could not send request: %+v", err)
			continue
		}
		_ = resp.Body.Close()

		// To create a more interesting histogram, every so often we change the sleep interval
		if time.Now().After(nextCheck) {
			nextCheck, duration = newDurations()
		}
	}
}

func newDurations() (nextCheck time.Time, duration time.Duration) {
	// Between 100ms and 5s
	duration = time.Millisecond * time.Duration(100*(1+rand.Int()%50))
	nextCheck = time.Now().Add(time.Second * time.Duration(rand.Int()%120))
	log.Printf("Duration: %s Next Change: %s", duration, nextCheck)
	return
}

type Payload struct {
	Timestamp string `json:"@timestamp"`
	Service   string `json:"service"`
	Level     string `json:"level"`
	Message   string `json:"message"`
	Power     int    `json:"power,omitempty"`
	Dexterity int    `json:"dexterity,omitempty"`
	Charge    struct {
		Attack   int
		Strength int
	} `json:"charge,omitempty"`
}

func genPayload() (*bytes.Buffer, error) {
	payload := Payload{
		Timestamp: time.Now().UTC().Format("2006-01-02T15:04:05-0700"),
	}

	switch rand.Int() % 3 {
	case 0:
		payload.Level = "INFO"
		payload.Message = fmt.Sprintf("A descriptive info message %d", rand.Int())
	case 1:
		payload.Level = "DEBUG"
		payload.Message = fmt.Sprintf("%d is debugging %d and %d", rand.Int()%5, rand.Int()%10000, rand.Int()%10000)
	case 2:
		payload.Level = "ERROR"
		payload.Message = fmt.Sprintf("error running process %d with command %d", rand.Int()%32767, rand.Int())
	}

	switch rand.Int() % 5 {
	case 0:
		payload.Service = "shredder"
	case 1:
		payload.Service = "flipper"
	case 2:
		payload.Service = "tainter"
	case 3:
		payload.Service = "mover"
	case 4:
		payload.Service = "crusher"
	}

	if rand.Int()%2 == 0 {
		payload.Charge = struct {
			Attack   int
			Strength int
		}{Attack: rand.Int() % 100, Strength: rand.Int() % 100}
	}
	if rand.Int()%2 == 0 {
		payload.Power = rand.Int() % 10
	}
	if rand.Int()%3 == 0 {
		payload.Dexterity = rand.Int() % 10
	}

	log.Printf("%+v", payload)

	buf := &bytes.Buffer{}
	err := json.NewEncoder(buf).Encode(&payload)
	return buf, err
}
