# Bonus: Terraform to provision the Kubernetes cluster.
#
# This is written for a local `kind` (Kubernetes-in-Docker) cluster, which
# needs no cloud account/credentials, so anyone can `terraform apply` this
# and get a real, working cluster in ~1 minute. For a cloud deployment,
# swap the `kind` provider block below for your cloud's official module,
# e.g.:
#   - AWS:   terraform-aws-modules/eks/aws
#   - GCP:   terraform-google-modules/kubernetes-engine/google
#   - Azure: Azure/aks/azurerm
# The rest of this repo (Docker image, k8s manifests, CI/CD) is
# cluster-agnostic and works unchanged against any of those.

terraform {
  required_providers {
    kind = {
      source  = "tehcyx/kind"
      version = "~> 0.4"
    }
  }
}

provider "kind" {}

resource "kind_cluster" "product_catalog" {
  name           = "product-catalog-cluster"
  wait_for_ready = true

  kind_config {
    kind        = "Cluster"
    api_version = "kind.x-k8s.io/v1alpha4"

    node {
      role = "control-plane"
      extra_port_mappings {
        container_port = 80
        host_port       = 8080
      }
      extra_port_mappings {
        container_port = 443
        host_port       = 8443
      }
    }

    node {
      role = "worker"
    }
    node {
      role = "worker"
    }
  }
}

output "kubeconfig_path" {
  value = kind_cluster.product_catalog.kubeconfig_path
}
