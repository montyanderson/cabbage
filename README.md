# cabbage

Self-hosted, auto-deployment service for Github, built at [Tedra](https://github.com/tedra).

[![dependencies Status](https://david-dm.org/montyanderson/cabbage/status.svg)](https://david-dm.org/montyanderson/cabbage)

## Usage
`cabbage` implements a JSON REST interface, for a graphical web interface see [cabbage-ui](https://github.com/montyanderson/cabbage-ui).

* Create a `Server`

```
curl -X POST http://cabbage/server/create
```

with the body

``` json
{
	"name": "Digital Ocean 1",
	"address": "127.0.0.1",
	"port": 22,
	"username": "www",
	"password": "********"
}
```

returns

``` json
	"id": 1
}
```

* Create a `Project`

```
curl -X POST http://cabbage/server/create
```

with the body

``` json
{
	"name": "My Website",
	"repo": "montyanderson/website",
	"servers": [ 1 ],
	"directory": "/var/www/website"
}
```

which returns

``` json
	"id": 1
}
```

* Add a webhook to your repository

![](http://i.imgur.com/i4dyF9H.png)

## Models

### `Server`

#### Schema

* `String` name
* `String` address
* `String` username
* `String` password
* `Number` id

#### Endpoints

* `PUT` /server
* `DELETE` /server?id=${id}
* `POST` /server
* `GET` /server?id=${id}
* `GET` /server/list

### `Project`

#### Schema

* `String` name
* `String` repo
* `Array[Number]` servers
* `Number` id

#### Endpoints

* `PUT` /project
* `DELETE` /project?id=${id}
* `POST` /project
* `GET` /project?id=${id}
* `GET` /project/list

## Install

### Prerequisites

* `node` (and `npm`) >= 8
* `redis` >= 3
* `ssh`
* `scp`
* `sshpass`


* Install `ssh`, `scp`, and `sshpass`

```
$ sudo apt-get install openssh-server sshpass
```

* Install `node` (using `nvm`)

```
$ curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.2/install.sh | bash
$ su $USER
$ nvm install latest
```

* Install [`redis`](https://redis.io/download) as per [instructions](https://redis.io/download#installation).

Run the script to create a service.

```
$ sudo ./utils/install.server.sh
```

* Clone the `cabbage` repository

```
$ git clone https://github.com/montyanderson/cabbage
```

* Install dependencies

```
$ cd cabbage
$ npm install
```

* Generate a random 'push secret' for use with webhooks

```
$ cat /dev/urandom | head -c 32 | base64 > .push_secret
```

* Generate a user account for viewing/creating/changing projects and servers

```
$ cat > .auth.json << }
{
	"name": "monty",
	"pass": "a"
}

```

* Start the node server

```
$ node index
```

* [Get started](#Usage)
