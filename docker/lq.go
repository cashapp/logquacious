// The entry point of the Loquacious docker image.
//
// If a config file is given via a volume mount at /lq/config.ts, the file will be used.
// Otherwise it will be generated with some optional variables.
//
// Similarly if a /etc/nginx/lq.conf is given it will be used instead of generating one.
package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path"
	"strings"
	"text/template"

	"github.com/alecthomas/kong"
	"github.com/pkg/errors"
)

type Vars struct {
	ESProxy             bool     `env:"ES_PROXY" default:"true" help:"Use a reverse proxy for ElasticSearch to avoid needing CORS. (ES_PROXY)"`
	ESURL               string   `env:"ES_URL" name:"es-url" help:"ElasticSearch host to send queries to, e.g.: http://my-es-server:9200/ (ES_URL)"`
	ESIndex             string   `env:"ES_INDEX" default:"*" help:"ElasticSearch index to search in. (ES_INDEX)"`
	TimestampField      string   `env:"TIMESTAMP_FIELD" default:"@timestamp" help:"The field containing the main timestamp entry. (TIMESTAMP_FIELD)"`
	SecondaryIndex      string   `env:"SECONDARY_INDEX" default:"" help:"The field containing a secondary index to sort if timestamps are equal. (SECONDARY_INDEX)"`
	LevelField          string   `env:"LEVEL_FIELD" default:"level" help:"The field containing the log level. (LEVEL_FIELD)"`
	ServiceField        string   `env:"SERVICE_FIELD" default:"service" help:"The field containing the name of the service. (SERVICE_FIELD)"`
	MessageField        string   `env:"MESSAGE_FIELD" default:"message" help:"The field containing the main message of the log entry. (MESSAGE_FIELD)"`
	IgnoredFields       []string `env:"IGNORED_FIELDS" default:"_id,_index" help:"Do not display these fields in the collapsed log line. (IGNORED_FIELDS)"`
	IgnoredFieldsJoined string   `hidden:""`
}

const lqTemplate = "config.json"
const lqDest = "/lq/config.json"
const nginxTemplate = "nginx"
const nginxDest = "/etc/nginx/conf.d/lq.conf"

func main() {
	err := run()
	if err != nil {
		log.Fatalf("%+v\n", err)
	}
}

func run() error {
	vars := Vars{}
	kong.Parse(&vars)
	log.Printf("Variables for this docker image looks like this:\n%+v", vars)

	if exists(lqDest) {
		log.Printf("%s exists in this container! Ignoring command-line options that configure lq.", lqDest)
	}

	if !exists(lqDest) && !exists(nginxDest) && vars.ESURL == "" {
		return errors.Errorf("ES_URL (--es-url) was not specified.")
	}

	vars.IgnoredFieldsJoined = fmt.Sprintf(`"%s"`, strings.Join(vars.IgnoredFields, `","`))

	err := tmpl(nginxTemplate, nginxDest, vars)
	if err != nil {
		return err
	}

	err = tmpl(lqTemplate, lqDest, vars)
	if err != nil {
		return err
	}

	log.Printf("Running nginx...")
	err = stream("nginx", "-g", "daemon off;")
	if err != nil {
		return errors.Wrapf(err, "nginx exited unusually")
	}

	return nil
}

func tmpl(name, dst string, vars Vars) error {
	src := fmt.Sprintf("/templates/%s", name)
	if exists(dst) {
		return nil
	}

	t, err := template.New(path.Base(src)).ParseFiles(src)
	if err != nil {
		panic(err)
	}

	fp, err := os.Create(dst)
	if err != nil {
		return errors.Wrapf(err, "could not create %s", dst)
	}

	err = t.Execute(fp, &vars)
	if err != nil {
		return errors.Wrapf(err, "could not execute template %s", dst)
	}

	log.Print("Successfully generated", dst)
	return nil
}

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func stream(name string, args ...string) error {
	cmd := exec.Command(name, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}
