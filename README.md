# cabbage

Self-hosted, auto-deployment service for Github, built at [Tedra](https://github.com/tedra).

[![dependencies Status](https://david-dm.org/montyanderson/cabbage/status.svg)](https://david-dm.org/montyanderson/cabbage)

## Usage

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

* Add a Webhook to your repository

![](http://i.imgur.com/d91RDQm.png)

## Prerequisites

* Node v8+
* `git`
* `scp`
* `sshpass`

## Models

### `Server`

#### Schema

* `String` name
* `String` address
* `String` username
* `String` password
* `Number` id

#### Endpoints

* `POST` /server/create
* `GET` /server/delete
* `POST` /server/edit
* `GET` /server/find
* `GET` /server/list

### `Project`

#### Schema

* `String` name
* `String` repo
* `Array[Number]` servers
* `Number` id

#### Endpoints

* `POST` /project/create
* `GET` /project/delete
* `POST` /project/edit
* `GET` /project/find
* `GET` /project/list
