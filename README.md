# cabbage

Self-hosted, auto-deployment service for Github, built at [Tedra](https://github.com/tedra).

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
